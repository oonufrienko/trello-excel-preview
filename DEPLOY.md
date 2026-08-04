# Deploy & Rollback

No Vercel git integration, but CI ships: **merging to main deploys to
production if the full e2e suite passes against that exact build**
(`.github/workflows/deploy.yml`). Nothing else deploys by itself — a PR run only
stages a build and moves the dev alias.

**A red `deploy` run almost always means nothing shipped**: the promote step
runs after the suite, so anything failing before it leaves production on the
build it was already serving. The one exception is a failure *after* promote —
the dev alias or the production health check — and there the run summary opens
with "Production shipped, post-promote steps failed". Read the summary before
assuming a red run kept the merge off production; [Rollback](#rollback) is the
way back.

The commands below are for deploying by hand, which is still how you ship
outside the merge path (or when CI is unavailable).

## Dev (test environment)

```bash
npx vercel deploy                    # builds a preview, prints a unique URL
npx vercel alias set <preview-url> trello-excel-preview-dev.vercel.app
```

The Power-Up on the Trello test board is registered against
`trello-excel-preview-dev.vercel.app`, so local and CI e2e runs exercise
whatever that alias points at. **Always re-point the alias after deploying**,
otherwise tests hit stale code. Then: `npx playwright test`.

Aliases: `npx vercel alias ls` to inspect, `alias set` to switch, or
Vercel Dashboard → project → Settings → Domains.

**CI moves this alias too.** When an e2e run on a pull request goes green it
points `trello-excel-preview-dev.vercel.app` at that PR's build, so you can look
at the change in Trello without deploying anything by hand. The alias stays
there only until the PR is finished: merging it hands the alias to the build
`deploy.yml` ships to production, and closing it without merging triggers
`reset-dev`, which builds main and aliases it back. That matters because the
nightly e2e run tests the dev alias — left on a branch, the nightly would report
on that branch instead of on main. To put main back sooner (you are done
looking, but the PR stays open), run it by hand:
**Actions → reset-dev → Run workflow**.

## Prod

```bash
git checkout main && git pull
npx vercel deploy --prod             # updates trello-excel-preview.vercel.app
```

## Which commit is production serving?

```bash
curl -s https://trello-excel-preview.vercel.app/api/health
git rev-parse --short origin/main
```

`/api/health` answers with the commit it was built from:

```json
{"status":"ok","version":"1.0.0","commit":"d418328","env":"production","uptimeSeconds":8,"timestamp":"..."}
```

- `commit` equals `origin/main` → production is up to date.
- `commit` is behind → main has merges that were never deployed. Deploy, or
  re-run the `deploy` workflow.
- small `uptimeSeconds` → the deployment you just made is the one serving
  (the instance restarted).
- `env` should read `production`. Anything else means the production domain is
  pointing at a staged build.

The commit comes from the checkout's HEAD, so a local `vercel deploy` with
uncommitted changes reports HEAD while serving something else. From CI, where
the checkout is clean, it is exact.

## Rollback

**Instant (seconds, git untouched):**

```bash
npx vercel ls                        # find the previous Production deployment
npx vercel rollback <previous-prod-url>
```

Or: Dashboard → Deployments → pick the deployment → ⋯ → Instant Rollback.

Instant rollback only reaches deployments that still exist. The
`prune-deployments` workflow deletes anything older than 5 days (keeping the
5 newest and everything that has an alias), so for an older release use the code
rollback below. Vercel keeps deleted deployments restorable for 30 days under
Settings → Security → Recently Deleted.

**Code rollback (when main must be reverted too):**

```bash
git revert -m 1 <merge-commit-sha> --no-edit
git push origin main
npx vercel deploy --prod
```
