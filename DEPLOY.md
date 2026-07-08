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
