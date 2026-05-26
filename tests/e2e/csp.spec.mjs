// Explicit CSP enforcement test. Runs fetch() from inside the Power-Up
// iframe against:
//   - origins our CSP allows: api.trello.com, trello.com apex, p.trellocdn.com
//     → request should reach the network (response status doesn't matter,
//       only that it's not blocked by CSP).
//   - an origin our CSP forbids: example.com
//     → fetch must reject AND emit a securitypolicyviolation event.
//
// This catches issues my earlier suite missed because source-map / .map
// fetches only happen when DevTools is open. Going through fetch() puts
// the same request through the same `connect-src` directive without
// needing DevTools.
import { test, expect } from './_setup.mjs';

const ANY_FIXTURE = 'multi-sheet.xlsx';

const ALLOWED = [
  'https://api.trello.com/1/members/me',
  'https://trello.com/robots.txt',
  'https://p.trellocdn.com/power-up.min.js.map'
];
const FORBIDDEN = 'https://example.com/should-be-blocked';

test('CSP: connect-src allows trello.com/api/trellocdn, blocks unknown origins', async ({ page, fixtureIds, cspViolations }) => {
  const info = fixtureIds[ANY_FIXTURE];
  expect(info, `Fixture ${ANY_FIXTURE} not seeded`).toBeTruthy();

  await page.goto(`https://trello.com/c/${info.cardShortLink}`);

  // Wait for the Power-Up's attachment-section iframe to render.
  const powerUp = page.frameLocator('iframe[src*="trello-excel-preview"]').first();
  await powerUp.locator('.attachment-item').first().waitFor({ state: 'visible' });

  // Resolve the live Frame object so we can run JS inside it.
  const powerUpFrame = page.frames().find(f => /trello-excel-preview.*attachments-html/.test(f.url()))
                   || page.frames().find(f => f.url().includes('trello-excel-preview'));
  expect(powerUpFrame, 'Power-Up iframe frame handle').toBeTruthy();

  // Allowed: each fetch should not throw with TypeError("Failed to fetch")
  // caused by CSP. Network errors / 4xx-5xx responses are fine — we only
  // care that the request reached the network.
  for (const url of ALLOWED) {
    const result = await powerUpFrame.evaluate(async (u) => {
      try {
        const r = await fetch(u, { mode: 'no-cors' });
        return { ok: true, status: r.status };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, url);
    expect(result, `Allowed URL ${url} should not be blocked: ${JSON.stringify(result)}`).toMatchObject({ ok: true });
  }

  // Forbidden: should throw OR emit a securitypolicyviolation event.
  const blockedResult = await powerUpFrame.evaluate(async (u) => {
    try { await fetch(u, { mode: 'no-cors' }); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  }, FORBIDDEN);
  // Allow ~250ms for the violation event to bubble to console.
  await page.waitForTimeout(250);

  const blockedByCsp = !blockedResult.ok ||
    cspViolations.some(v => v.includes('example.com'));
  expect(blockedByCsp, `Forbidden URL ${FORBIDDEN} should be CSP-blocked. fetch result=${JSON.stringify(blockedResult)}; violations=${cspViolations.join(',')}`).toBe(true);

  // Filter out the example.com violation we deliberately triggered.
  const unexpected = cspViolations.filter(v => !v.includes('example.com'));
  expect(unexpected, unexpected.join('\n')).toEqual([]);
});
