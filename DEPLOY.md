# Deploy & Rollback

No Vercel git integration: **nothing deploys automatically** on push or merge.
All deploys go through the Vercel CLI (`npx vercel`, already authorized).

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
there only until the PR is finished: closing or merging it triggers `reset-dev`,
which builds main and aliases it back. That matters because the nightly e2e run
tests the dev alias — left on a branch, the nightly would report on that branch
instead of on main. To put main back sooner (you are done looking, but the PR
stays open), run it by hand: **Actions → reset-dev → Run workflow**.

## Prod

```bash
git checkout main && git pull
npx vercel deploy --prod             # updates trello-excel-preview.vercel.app
```

Verify: `https://trello-excel-preview.vercel.app/api/health` — a small
`uptimeSeconds` means the fresh deployment is serving.

## Rollback

**Instant (seconds, git untouched):**

```bash
npx vercel ls                        # find the previous Production deployment
npx vercel rollback <previous-prod-url>
```

Or: Dashboard → Deployments → pick the deployment → ⋯ → Instant Rollback.

**Code rollback (when main must be reverted too):**

```bash
git revert -m 1 <merge-commit-sha> --no-edit
git push origin main
npx vercel deploy --prod
```
