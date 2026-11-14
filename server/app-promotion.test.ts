import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAppPromotion, readAppPromotion, validStoreUrl, validateAppPromotion } from '../src/lib/appPromotion';
import { homepagePatch } from './homepage-settings';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppPromotion from '../src/components/AppPromotion';
import { readFileSync } from 'node:fs';

test('defaults have no active download links; absent and invalid saved settings are safe', () => {
  assert.equal(validateAppPromotion(defaultAppPromotion()), null);
  assert.deepEqual(readAppPromotion(null), defaultAppPromotion());
  assert.deepEqual(readAppPromotion({ visible: true }), defaultAppPromotion());
  assert.equal(defaultAppPromotion().google_play.status, 'coming_soon');
});
test('store links validate the exact provider, listing and protocol', () => {
  assert.ok(validStoreUrl('https://play.google.com/store/apps/details?id=com.example.app&hl=en', 'google_play'));
  assert.ok(validStoreUrl('https://apps.apple.com/in/app/example/id123456?l=en', 'app_store'));
  for (const url of ['javascript:alert(1)', 'http://play.google.com/store/apps/details?id=com.example.app', 'https://user:pass@play.google.com/store/apps/details?id=com.example.app', 'https://play.google.com.evil.test/store/apps/details?id=com.example.app', 'https://play.google.com/store/apps/details', 'https://play.google.com:123/store/apps/details?id=com.example.app', 'https://play.google.com\\@evil.test/store/apps/details?id=com.example.app']) assert.equal(validStoreUrl(url, 'google_play'), false, url);
  assert.equal(validStoreUrl('https://apps.apple.com/in/app/example', 'app_store'), false);
});
test('available requires URL, hidden and coming soon allow blank; text limits enforced', () => {
  for (const status of ['hidden', 'coming_soon', 'available'] as const) {
    const p = defaultAppPromotion(); p.google_play.status = status;
    assert.equal(validateAppPromotion(p) === null, status !== 'available');
  }
  const p = defaultAppPromotion(); p.heading = 'x'.repeat(121);
  assert.ok(validateAppPromotion(p)); p.heading = '  '; assert.ok(validateAppPromotion(p));
});
test('partial and older saves preserve omitted homepage fields', () => {
  assert.deepEqual(homepagePatch({ hero_title: 'New title' }), { id: 'mppsc_homepage', hero_title: 'New title' });
  const promotion = defaultAppPromotion();
  assert.deepEqual(homepagePatch({ app_promotion: promotion, untrusted: true }), { id: 'mppsc_homepage', app_promotion: promotion });
  assert.throws(() => homepagePatch({ app_promotion: null }));
  assert.throws(() => homepagePatch({ faqs: 'invalid' }));
});
test('public promotion hides sections/stores and only available stores become protected external links', () => {
  const p = defaultAppPromotion();
  assert.doesNotMatch(renderToStaticMarkup(createElement(AppPromotion, { settings: p })), /<a /);
  p.google_play = { status: 'available', url: 'https://play.google.com/store/apps/details?id=com.example.app' };
  p.app_store.status = 'hidden';
  const html = renderToStaticMarkup(createElement(AppPromotion, { settings: p }));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /App Store/);
  p.visible = false;
  assert.equal(renderToStaticMarkup(createElement(AppPromotion, { settings: p })), '');
});
test('website has no unfinished subscription form', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /Subscribe to our weekly|Stay Updated with MPPSC Notifications/);
});
