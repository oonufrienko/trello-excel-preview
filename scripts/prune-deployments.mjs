#!/usr/bin/env node
// Delete old Vercel deployments for this project.
//
// Every PR push stages a build (see .github/workflows/e2e.yml), and with no
// retention policy set on the project Vercel keeps deployments indefinitely, so
// the list grows without bound. Vercel's own policy is configured in months and
// would also govern real production deployments, so we prune ourselves instead.
//
// Never removed:
//   - anything with an alias on it (production domain, dev alias) — `vercel
//     remove --safe` enforces this server-side, we don't rely on our own list
//   - the newest KEEP_NEWEST deployments, whatever their age, so there is
//     always something recent to `vercel rollback` to
//   - anything younger than MAX_AGE_DAYS
//
// Dry run by default. Pass --yes to actually delete.
// Run: npm run prune-deployments -- --yes
import { execFileSync } from 'node:child_process';

const PROJECT = 'trello-excel-preview';
const SCOPE = 'oonufrienkos-projects';
const CLI = 'vercel@58.1.0';
const PAGE = 100;      // CLI max per page
const MAX_PAGES = 20;  // stop runaway pagination rather than loop forever

// Fail closed on a bad knob: a negative PRUNE_DAYS would put the cutoff in the
// future and sweep everything, and a negative PRUNE_KEEP_NEWEST would protect
// the wrong end of the list.
//
// Match digits rather than trusting Number(): it reads " " and "\n" as 0, which
// would put the cutoff at now and make every unaliased deployment stale, and it
// silently accepts "0x10" as 16 and "1e3" as 1000.
function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n)) {
    console.error(`${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
    process.exit(1);
  }
  return n;
}

const MAX_AGE_DAYS = positiveInt('PRUNE_DAYS', 5);
const KEEP_NEWEST = positiveInt('PRUNE_KEEP_NEWEST', 5);

const apply = process.argv.includes('--yes');
const auth = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : [];

function vercel(args) {
  return execFileSync('npx', ['--yes', CLI, ...args, '--scope', SCOPE, ...auth], {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

// Both `ls` and `alias ls` cap a page at 100 and hand back a `pagination.next`
// cursor. Without following it the script would only ever see the newest page —
// deployments past it would age out of view and become immortal.
function listAll(args, key) {
  const items = [];
  let next;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = next ? [...args, '--next', String(next)] : args;
    const body = JSON.parse(vercel(query));
    items.push(...(body[key] || []));
    next = body.pagination && body.pagination.next;
    if (!next) return items;
  }
  console.error(`Stopped after ${MAX_PAGES} pages of ${key}; refusing to prune on a partial list.`);
  process.exit(1);
}

// Belt and braces: removal also passes --safe, which is what actually
// guarantees an aliased deployment survives. This just keeps them out of the
// candidate list so the dry run reads honestly.
//
// `.url` is the deployment the alias points at, in the same bare-host form
// `ls` reports (`<project>-<hash>-<scope>.vercel.app`); `.alias` is the domain
// (`trello-excel-preview.vercel.app`). Matching on `.alias` would never hit.
const aliased = new Set(
  listAll(['alias', 'ls', '--json', '--limit', String(PAGE)], 'aliases').map(a => a.url)
);

const deployments = listAll(['ls', PROJECT, '--json', '--limit', String(PAGE)], 'deployments');
deployments.sort((a, b) => b.createdAt - a.createdAt);

const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
const stale = deployments
  .slice(KEEP_NEWEST)
  .filter(d => d.createdAt < cutoff)
  .filter(d => !aliased.has(d.url));

const age = d => ((Date.now() - d.createdAt) / 86_400_000).toFixed(1);
console.log(`${deployments.length} deployments; keeping the newest ${KEEP_NEWEST} and anything under ${MAX_AGE_DAYS} days old.`);
// `alias ls` is account-wide, so aliased.size counts aliased deployments across
// every project. Report the ones actually in this project's list instead.
const protectedByAlias = deployments.filter(d => aliased.has(d.url));
console.log(`${protectedByAlias.length} deployment(s) of this project hold an alias and are never candidates.`);

if (!stale.length) {
  console.log('Nothing to prune.');
  process.exit(0);
}

console.log(`\n${stale.length} candidate(s):`);
for (const d of stale) console.log(`  ${d.url}  (${d.target || 'preview'}, ${age(d)} days)`);

if (!apply) {
  console.log('\nDry run — pass --yes to delete. Aliased deployments are skipped either way.');
  process.exit(0);
}

console.log('\nRemoving...');
console.log(vercel(['remove', ...stale.map(d => d.url), '--safe', '--yes']));
