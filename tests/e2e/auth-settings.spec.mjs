// Compliance checks for Marketplace guideline #9 (auth capabilities)
// + Developer Terms §9.4 (Terms of Use) + on-enable welcome modal.
//
// HTTP-level checks: each new endpoint/static page must serve expected
// content. Full UI flows for settings/disconnect are exercised manually
// during smoke (clicking Show Settings inside Trello), since Trello's
// menu UI is brittle for Playwright selectors.
import { test, expect } from './_setup.mjs';

const HOST = process.env.PREVIEW_HOST
  ? `https://${process.env.PREVIEW_HOST}`
  : 'https://trello-excel-preview.vercel.app';

test('connector.js declares all required Marketplace capabilities', async ({ request }) => {
  const res = await request.get(`${HOST}/js/connector.js`);
  expect(res.status()).toBe(200);
  const js = await res.text();
  expect(js, 'attachment-sections').toMatch(/['"]attachment-sections['"]/);
  expect(js, 'authorization-status').toMatch(/['"]authorization-status['"]/);
  expect(js, 'show-authorization').toMatch(/['"]show-authorization['"]/);
  expect(js, 'show-settings').toMatch(/['"]show-settings['"]/);
  expect(js, 'on-enable').toMatch(/['"]on-enable['"]/);
});

test('root path serves connector HTML with app key injected', async ({ request }) => {
  const res = await request.get(`${HOST}/`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('window.TRELLO_APP_KEY');
  expect(html).toContain('/js/connector.js');
});

test('/api/settings-html serves the settings popup UI', async ({ request }) => {
  const res = await request.get(`${HOST}/api/settings-html`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-security-policy']).toBeTruthy();
  const html = await res.text();
  expect(html).toContain('Checking authorization');
  expect(html).toContain('/js/settings.js');
  expect(html).toContain('/privacy.html');
  expect(html).toContain('/terms.html');
});

test('/api/auth-html serves authorize popup UI', async ({ request }) => {
  const res = await request.get(`${HOST}/api/auth-html`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-security-policy']).toBeTruthy();
  const html = await res.text();
  expect(html).toContain('Authorize');
  expect(html).toContain('/js/auth.js');
});

test('/js/auth.js calls authorize() from popup context', async ({ request }) => {
  const res = await request.get(`${HOST}/js/auth.js`);
  expect(res.status()).toBe(200);
  const js = await res.text();
  expect(js).toMatch(/authorize\(\{ ?scope/);
  expect(js).toMatch(/closePopup/);
});

test('/js/settings.js exposes authorize + clearToken handlers', async ({ request }) => {
  const res = await request.get(`${HOST}/js/settings.js`);
  expect(res.status()).toBe(200);
  const js = await res.text();
  expect(js).toMatch(/clearToken/);
  expect(js).toMatch(/authorize\(/);
  expect(js).toMatch(/isAuthorized/);
});

test('/terms.html exists with both EN and UA sections', async ({ request }) => {
  const res = await request.get(`${HOST}/terms.html`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('Terms of Use');
  expect(html).toContain('Умови використання');
  expect(html).toContain('onufrienko.alex@gmail.com');
  // Links from terms back to privacy and vice versa
  expect(html).toMatch(/href="\/privacy\.html"/);
});

test('/privacy.html links to /terms.html in both languages', async ({ request }) => {
  const res = await request.get(`${HOST}/privacy.html`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/href="\/terms\.html"/);
  // EN + UA references to terms
  expect(html).toContain('Terms of Use');
  expect(html).toContain('Умови використання');
});

test('/welcome.html exists and uses Power-Up iframe SDK', async ({ request }) => {
  const res = await request.get(`${HOST}/welcome.html`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('Simple Excel Viewer');
  expect(html).toContain('p.trellocdn.com/power-up.min.js');
  expect(html).toContain('closeModal');
});

test('preview footer no longer mentions Claude/Anthropic', async ({ request }) => {
  const res = await request.get(`${HOST}/api/preview-html`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).not.toMatch(/Claude|Anthropic/i);
  expect(html).toContain('Built with AI');
});
