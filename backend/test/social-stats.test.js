import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createSocialStatsService } from '../src/social-stats.js';

async function setup(t, snapshot) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fleet-social-'));
  const original = globalThis.fetch;
  t.after(async () => { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); });
  if (snapshot) {
    await mkdir(path.join(root, 'data'));
    await writeFile(path.join(root, 'data/social-stats-cache.json'), JSON.stringify(snapshot));
  }
  return root;
}
const env = { META_ACCESS_TOKEN: 'legacy-test-token', FACEBOOK_PAGE_ID: 'test-page', TIKTOK_ACCESS_TOKEN: 'test-tiktok' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function mockFetch(facebook) {
  globalThis.fetch = async url => String(url).includes('facebook.com')
    ? facebook(url) : json({ data: { user: { follower_count: 21, likes_count: 131 } } });
}

test('Facebook uses the dedicated Page token and never substitutes likes for followers', async t => {
  const root = await setup(t);
  mockFetch(url => {
    assert.equal(new URL(url).searchParams.get('access_token'), 'page-test-token');
    return json({ fan_count: 57 });
  });
  const stats = await createSocialStatsService({ ...env, FACEBOOK_PAGE_ACCESS_TOKEN: 'page-test-token' }, root).get();
  assert.equal(stats.platforms.facebook.followers, null);
  assert.equal(stats.platforms.facebook.likes, 57);
  assert.equal(stats.totals.followers, 21);
  assert.equal(stats.incomplete, true);
});

test('revoked Facebook token preserves last verified counts while TikTok stays live', async t => {
  const root = await setup(t);
  mockFetch(() => json({ followers_count: 100, fan_count: 60 }));
  const service = createSocialStatsService(env, root);
  const first = await service.get();
  mockFetch(() => json({ error: { code: 190, message: 'PRIVATE upstream error' } }, 400));
  const failed = await service.get({ force: true });
  assert.equal(failed.platforms.facebook.available, false);
  assert.equal(failed.platforms.facebook.stale, true);
  assert.equal(failed.platforms.facebook.followers, 100);
  assert.equal(failed.platforms.facebook.last_success_at, first.platforms.facebook.last_success_at);
  assert.equal(failed.platforms.facebook.error_code, 'reauthorization_required');
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE/);
  assert.equal(failed.platforms.tiktok.available, true);
  assert.equal(failed.totals.followers, 121);
  const restarted = await createSocialStatsService(env, root).get();
  assert.equal(restarted.platforms.facebook.followers, 100);
  assert.equal(restarted.platforms.facebook.last_success_at, first.platforms.facebook.last_success_at);
  mockFetch(() => json({ followers_count: 105, fan_count: 62 }));
  const recovered = await service.get({ force: true });
  assert.equal(recovered.platforms.facebook.available, true);
  assert.equal(recovered.platforms.facebook.stale, undefined);
  assert.equal(recovered.totals.followers, 126);
});

test('no historical count is invented when the token is invalid on first use', async t => {
  const root = await setup(t);
  mockFetch(() => json({ error: { code: 190, message: 'Invalid token' } }, 400));
  const stats = await createSocialStatsService(env, root).get();
  assert.equal(stats.platforms.facebook.followers, null);
  assert.equal(stats.platforms.facebook.stale, undefined);
  assert.equal(stats.totals.followers, 21);
});

test('expired historical counts and removed credentials do not stay in totals', async t => {
  for (const configured of [true, false]) {
    const root = await setup(t, { updated_at: new Date().toISOString(), platforms: {
      facebook: { available: true, followers: 100, likes: 60,
        last_success_at: new Date(Date.now() - 8 * 86400000).toISOString() }
    }});
    mockFetch(() => json({ error: { code: 190 } }, 400));
    const stats = await createSocialStatsService(configured ? env : { TIKTOK_ACCESS_TOKEN: 'test' }, root).get();
    assert.equal(stats.platforms.facebook.followers, null);
    assert.equal(stats.totals.followers, 21);
  }
});

test('homepage renders unknown counts as dashes and labels partial and stale totals', async () => {
  const script = await readFile(new URL('../../js/index.js', import.meta.url), 'utf8');
  const socialScript = script.slice(script.indexOf('(function loadLiveSocialStats()'));
  for (const stale of [false, true]) {
    const followers = {}, likes = {}, status = {}, total = {};
    const card = {
      dataset: { socialPlatform: 'facebook' }, classList: { toggle() {}, add() {} },
      querySelector(selector) { return selector === '[data-social-followers]' ? followers : selector === '[data-social-likes]' ? likes : null; },
      appendChild(note) { this.note = note; }
    };
    const document = {
      querySelectorAll: () => [card], createElement: () => ({ dataset: {} }),
      getElementById: id => id === 'socialLiveStatus' ? status : total
    };
    const data = { platforms: {
      facebook: { available: false, stale, followers: stale ? 100 : null, likes: null, last_success_at: new Date().toISOString() },
      tiktok: { available: true, followers: 21, likes: 131 }
    }, totals: { followers: stale ? 121 : 21, likes: null } };
    vm.runInNewContext(socialScript, { document, fetch: async () => ({ ok: true, json: async () => data }), Intl, Date });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(followers.textContent, stale ? '100' : '—');
    assert.equal(likes.textContent, '—');
    assert.match(status.textContent, /Partial social totals/);
    assert.equal(card.note.textContent, stale ? 'Last known count' : 'Count unavailable');
    assert.equal(status.textContent.includes('Includes last known counts'), stale);
  }
});
