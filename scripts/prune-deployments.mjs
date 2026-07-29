#!/usr/bin/env node
// Delete old Vercel deployments for this project.
//
// Every PR push stages a build (see .github/workflows/e2e.yml) and Vercel keeps
// deployments forever by default, so the list grows without bound. Vercel's own
// retention policy is configured in months and would also govern real
// production deployments, so we prune ourselves instead.
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
const MAX_AGE_DAYS = Number(process.env.PRUNE_DAYS || 5);
const KEEP_NEWEST = Number(process.env.PRUNE_KEEP_NEWEST || 5);

const apply = process.argv.includes('--yes');
const auth = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : [];

function vercel(args) {
  return execFileSync('npx', ['--yes', CLI, ...args, '--scope', SCOPE, ...auth], {
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
}

const { deployments } = JSON.parse(vercel(['ls', PROJECT, '--json', '--limit', '100']));
deployments.sort((a, b) => b.createdAt - a.createdAt);

const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
const stale = deployments
  .slice(KEEP_NEWEST)
  .filter(d => d.createdAt < cutoff);

const age = d => ((Date.now() - d.createdAt) / 86_400_000).toFixed(1);
console.log(`${deployments.length} deployments; keeping the newest ${KEEP_NEWEST} and anything under ${MAX_AGE_DAYS} days old.`);

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

// --safe makes Vercel refuse to delete anything that still has an alias, so a
// stale local list can never take down production or dev.
console.log('\nRemoving...');
console.log(vercel(['remove', ...stale.map(d => d.url), '--safe', '--yes']));
