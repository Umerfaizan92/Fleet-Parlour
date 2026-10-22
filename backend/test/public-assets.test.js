import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { isPublicAssetPath, publicAssetsOnly } from '../src/public-assets.js';

test('private runtime data and repository files cannot enter static serving', () => {
  for (const url of [
    '/backend/data/fleet-parlour.sqlite', '/backend/data/tiktok-oauth.json',
    '/backend/data/uploads/customer/photo.jpg', '/backend/src/server.js',
    '/backend/package-lock.json', '/.env', '/.git/config', '/package-lock.json',
    '/PROJECT-GUIDE.md', '/backend/.env', '/data/customer.sqlite',
    '/images/../backend/data/fleet-parlour.sqlite',
    '/%62ackend/data/tiktok-oauth.json', '/images/%2e%2e/backend/data/token.json',
    '/images/%2eenv', '/images/%00photo.jpg', '/images%5c..%5cbackend/data/file.jpg',
    '/%invalid'
  ]) assert.equal(isPublicAssetPath(url), false, url);
});

test('website pages, scripts and images remain available', () => {
  for (const url of ['/', '/about', '/contact.html', '/styles.css',
    '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/favicon.ico',
    '/js/main.js', '/images/hero-background.webp', '/icons/home/shield.png',
    '/service-gallery-images/example.jpg'
  ]) assert.equal(isPublicAssetPath(url), true, url);
});

test('private requests skip static middleware and public requests reach it', () => {
  let served = 0, skipped = 0;
  const middleware = publicAssetsOnly(() => { served++; });
  middleware({ path: '/backend/data/tiktok-oauth.json' }, {}, () => { skipped++; });
  middleware({ path: '/contact.html' }, {}, () => { skipped++; });
  assert.equal(served, 1);
  assert.equal(skipped, 1);
});

test('HTTP requests cannot retrieve customer files even when they exist below siteRoot', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fleet-static-test-'));
  const app = express();
  let server;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'backend/data/uploads/customer'), { recursive: true });
  await mkdir(path.join(root, 'images'), { recursive: true });
  await writeFile(path.join(root, 'backend/data/tiktok-oauth.json'), 'PRIVATE_TOKEN_SENTINEL');
  await writeFile(path.join(root, 'backend/data/fleet-parlour.sqlite'), 'PRIVATE_DATABASE_SENTINEL');
  await writeFile(path.join(root, 'backend/data/uploads/customer/photo.jpg'), 'PRIVATE_PHOTO_SENTINEL');
  await writeFile(path.join(root, 'contact.html'), 'PUBLIC_PAGE');
  await writeFile(path.join(root, 'images/hero.webp'), 'PUBLIC_IMAGE');
  app.use(publicAssetsOnly(express.static(root, { extensions: ['html'] })));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/backend/data/tiktok-oauth.json', '/backend/data/fleet-parlour.sqlite',
    '/backend/data/uploads/customer/photo.jpg', '/%62ackend/data/tiktok-oauth.json']) {
    const response = await fetch(base + url);
    assert.equal(response.status, 404, url);
    assert.doesNotMatch(await response.text(), /PRIVATE_.*_SENTINEL/);
  }
  for (const url of ['/contact', '/contact.html', '/images/hero.webp', '/api/health']) {
    assert.equal((await fetch(base + url)).status, 200, url);
  }
});

test('full application boots and keeps admin and backend files private', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fleet-boot-test-'));
  const probe = net.createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test',
      DATABASE_PATH: path.join(root, 'test.sqlite'), UPLOAD_DIR: path.join(root, 'uploads'),
      ADMIN_API_KEY: '', RESEND_API_KEY: '', NOTIFY_TO: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error(`Application failed to boot: ${output}`);
    try { healthy = (await fetch(base + '/api/health')).status === 200; } catch {}
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, output);
  for (const url of ['/', '/contact', '/contact.html', '/styles.css']) {
    assert.equal((await fetch(base + url)).status, 200, url);
  }
  for (const url of ['/backend/src/server.js', '/backend/package.json', '/backend/data/tiktok-oauth.json']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
  assert.equal((await fetch(base + '/api/admin/enquiries')).status, 401);
});
