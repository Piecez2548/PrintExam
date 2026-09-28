import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import test from 'node:test';
import { getTrustProxySetting } from '../../src/config/proxy';

function listen(app: express.Express): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('production trusts exactly one Railway proxy hop', () => {
  assert.equal(getTrustProxySetting('production'), 1);
  assert.equal(getTrustProxySetting('development'), false);
  assert.equal(getTrustProxySetting(undefined), false);
});

test('rate limiting accepts forwarded client IPs and remains active in production', async () => {
  const app = express();
  app.set('trust proxy', getTrustProxySetting('production'));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.get('/health', (_req, res) => res.json({ ok: true }));

  const server = await listen(app);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/health`;
  const headers = { 'X-Forwarded-For': '203.0.113.10' };

  try {
    assert.equal((await fetch(url, { headers })).status, 200);
    assert.equal((await fetch(url, { headers })).status, 200);
    assert.equal((await fetch(url, { headers })).status, 429);
  } finally {
    await close(server);
  }
});
