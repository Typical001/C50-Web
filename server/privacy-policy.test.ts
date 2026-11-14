import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const policy = read('../public/privacy/index.html');
test('policy has complete identity, real provider disclosures and valid section anchors', () => {
  for (const value of ['November 14, 2026', 'Carrier-50 Institute', 'Sunil Rajput', 'carrierdds50@gmail.com', 'A2 Anand Nagar', '474012', 'Supabase', 'Render', 'Razorpay', 'YouTube/Google', 'Termly', 'C50 does not store full card numbers']) assert.ok(policy.includes(value), value);
  assert.doesNotMatch(policy, /_{3,}|<script|Cookie Notice:|Do-Not-Track|Push Notifications/i);
  const ids = [...policy.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of policy.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), match[1]);
  for (const route of ['/', '/terms', '/delete-account']) assert.ok(policy.includes(`href="${route}"`));
});
test('adult eligibility and deletion commitments agree across public policies', () => {
  const terms = read('../public/terms/index.html');
  const deletion = read('../public/delete-account/index.html');
  for (const content of [policy, terms]) {
    assert.match(content, /aged 18 or older/);
    assert.doesNotMatch(content, /under 13|guardian must review|authorize your use/);
  }
  for (const content of [policy, deletion]) {
    assert.match(content, /30 days from verification of account ownership/);
    assert.match(content, /legal obligation or.*unresolved dispute/s);
  }
  assert.match(policy, /associated with a deletion request/);
});
