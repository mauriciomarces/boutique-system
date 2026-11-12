const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getClientIpRateLimitKey, getTrustedClientIp } = require('../src/rate-limit');

function request(headers, ip = '172.20.0.5') {
  return {
    headers,
    ip,
    get(name) {
      return headers[name.toLowerCase()];
    },
  };
}

test('rate limit uses the client IP forwarded by the trusted gateway', () => {
  const first = request({
    'x-client-ip': '192.0.2.10',
    'x-internal-service-key': 'shared-secret',
  });
  const second = request({
    'x-client-ip': '192.0.2.11',
    'x-internal-service-key': 'shared-secret',
  });

  assert.equal(getTrustedClientIp(first, 'shared-secret'), '192.0.2.10');
  assert.notEqual(
    getClientIpRateLimitKey(first, 'shared-secret'),
    getClientIpRateLimitKey(second, 'shared-secret'),
  );
});

test('untrusted forwarded IP headers cannot bypass the limiter key', () => {
  const req = request({
    'x-client-ip': '192.0.2.10',
    'x-internal-service-key': 'wrong-secret',
  });

  assert.equal(getTrustedClientIp(req, 'shared-secret'), null);
  assert.equal(
    getClientIpRateLimitKey(req, 'shared-secret'),
    getClientIpRateLimitKey(request({}, req.ip), 'shared-secret'),
  );
});

test('limiter keeps enforcing its threshold independently for gateway clients', async () => {
  const secret = 'shared-secret';
  const app = express();
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 1,
      keyGenerator: (req) => getClientIpRateLimitKey(req, secret),
      standardHeaders: false,
      legacyHeaders: false,
    }),
  );
  app.get('/', (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const send = (clientIp) =>
      fetch(`http://127.0.0.1:${address.port}/`, {
        headers: {
          'x-client-ip': clientIp,
          'x-internal-service-key': secret,
        },
      });

    assert.equal((await send('192.0.2.10')).status, 200);
    assert.equal((await send('192.0.2.11')).status, 200);
    assert.equal((await send('192.0.2.10')).status, 429);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
