// Run with local Vite servers on 5179 (Web) and 5180 (Admin).
// QA entrypoints under each app's ignored dist/qa mount the actual components.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON);
const { chromium } = require('playwright');
for (const [folder, component, body] of [
  ['../dist/qa/', 'PremiumNotes', "<PremiumNotes userId='fixture-user' onLogin={() => {}} />"],
  ['../../admin-panel/dist/qa/', 'PremiumNotesCMS', '<PremiumNotesCMS />'],
]) {
  const dir = new URL(folder, import.meta.url); await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>');
  const fixtureAuth = component === 'PremiumNotesCMS' ? "import {supabase} from '/src/lib/supabaseClient'; supabase.auth.getSession=async()=>({data:{session:{access_token:'fixture-only',user:{id:'fixture-user'}}},error:null});" : '';
  await writeFile(new URL('entry.tsx', dir), `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/index.css'; import ${component} from '/src/components/${component}'; ${fixtureAuth} createRoot(document.getElementById('root')!).render(${body});`);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = new URL('../dist/qa/', import.meta.url); await mkdir(out, { recursive: true });
const product = { id: '00000000-0000-4000-8000-000000000001', title: 'MPPSC Premium Notes', description: 'Detailed revision notes for preparation.', contents: 'History and geography PDFs', kind: 'bundle', price_paise: 49900, cover_url: '', published: true, sort_order: 0, checkout_url: 'https://forms.gle/fixture', delivery_instructions: 'Delivery is arranged by the seller.', updated_at: '2026-11-18T00:00:00Z' };
let products = [product], requests = [], fail = false, posts = 0;
const context = await browser.newContext();
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path.startsWith('/api/')) {
    if (fail) return route.fulfill({ status: 503, json: { error: 'Fixture service unavailable' } });
    if (path === '/api/premium-notes') return route.fulfill({ json: products });
    if (path === '/api/premium-notes/mine') return route.fulfill({ json: requests });
    if (path.endsWith('/request')) {
      posts++;
      if (!requests.length) requests = [{ id: 'fixture-request', product_id: product.id, user_id: 'fixture-user', title_snapshot: product.title, price_paise: product.price_paise, status: 'pending', delivery_status: 'pending', created_at: product.updated_at, updated_at: product.updated_at, product }];
      return route.fulfill({ json: { request: requests[0], checkout_url: product.checkout_url } });
    }
    if (path === '/api/admin/premium-notes') {
      if (route.request().method() === 'POST') { products = [...products, { ...route.request().postDataJSON(), id: 'new-product', updated_at: product.updated_at }]; return route.fulfill({ json: products.at(-1) }); }
      return route.fulfill({ json: products });
    }
    if (path.startsWith('/api/admin/premium-notes/')) { products = products.map(p => p.id === path.split('/').at(-1) ? { ...p, ...route.request().postDataJSON() } : p); return route.fulfill({ json: products[0] }); }
    if (path.endsWith('/history')) return route.fulfill({ json: [] });
    if (path === '/api/admin/premium-note-requests') return route.fulfill({ json: { rows: requests, count: requests.length, emails: { 'fixture-user': 'fixture@example.test' } } });
    if (path.startsWith('/api/admin/premium-note-requests/')) { requests[0] = { ...requests[0], ...route.request().postDataJSON(), updated_at: '2026-11-18T01:00:00Z' }; return route.fulfill({ json: requests[0] }); }
    return route.fulfill({ status: 404, json: { error: 'Unknown fixture route' } });
  }
  if (url.hostname === 'forms.gle') return route.fulfill({ contentType: 'text/html', body: '<p>External form fixture — no submission or payment</p>' });
  if (url.hostname === '127.0.0.1') return route.continue();
  return route.abort(); // Never call live services in these tests.
});
try {
  const page = await context.newPage();
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('http://127.0.0.1:5179/dist/qa/');
    await page.getByRole('button', { name: 'View details' }).click();
    await page.getByRole('button', { name: 'Buy', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: new URL(`web-${width}.png`, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  }
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Buy', exact: true }).click();
  const external = await opened; await external.waitForURL('https://forms.gle/fixture');
  assert.equal(await external.evaluate(() => window.opener === null), true); await external.close();
  assert.equal(await page.getByRole('button', { name: 'Pending verification', exact: true }).isDisabled(), true);
  assert.equal(posts, 1);
  const reopened = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Reopen form' }).click(); const external2 = await reopened; await external2.waitForURL('https://forms.gle/fixture'); await external2.close();
  assert.equal(requests.length, 1);
  const admin = await context.newPage(); await admin.setViewportSize({ width: 1200, height: 960 }); await admin.goto('http://127.0.0.1:5180/dist/qa/');
  await admin.getByRole('button', { name: 'Review / history' }).click();
  await admin.getByLabel('Decision', { exact: true }).selectOption('purchased');
  await admin.getByLabel('Internal verification / correction reason').fill('Fixture verification, not a real payment');
  await admin.getByRole('button', { name: 'Save decision' }).click();
  await admin.getByRole('button', { name: 'Review / history' }).waitFor();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Purchased', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Purchased', exact: true }).isDisabled(), true);
  await admin.getByRole('button', { name: /MPPSC Premium Notes/ }).click();
  await admin.getByLabel('Title', { exact: true }).fill('Edited premium bundle');
  await admin.getByRole('button', { name: 'Save listing' }).click();
  await admin.getByRole('button', { name: /Edited premium bundle/ }).waitFor();
  await admin.getByRole('button', { name: 'Reload', exact: true }).click();
  await admin.getByRole('button', { name: /Edited premium bundle/ }).click();
  assert.equal(await admin.getByLabel('Title', { exact: true }).inputValue(), 'Edited premium bundle');
  await admin.screenshot({ path: new URL('admin-1200.png', out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
  requests = []; products = []; await page.goto('http://127.0.0.1:5179/dist/qa/'); await page.getByText('Premium notes will appear here when available.').waitFor();
  fail = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.getByRole('alert').waitFor();
  await admin.getByRole('button', { name: 'Reload', exact: true }).click(); await admin.getByRole('alert').waitFor(); assert.equal(await admin.getByRole('button', { name: 'Add notes / bundle' }).isDisabled(), true);
  fail = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.getByText('Premium notes will appear here when available.').waitFor();
  console.log('PASS: 1440/768/360 layouts, external opener isolation, pending/reopen dedup, Admin approval and status refresh, edit/save/reload, empty/error/retry, failed-load save lock. Fixtures only.');
} finally { await browser.close(); }
