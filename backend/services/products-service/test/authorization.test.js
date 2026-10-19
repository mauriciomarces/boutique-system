const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { verifiedActorId } = require('../../../contracts/event-actor');
const {
  createProductAuthorizationMiddleware,
  permissionForProductWrite,
} = require('../src/authorization');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function responseHarness() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('protege mutaciones de productos con el permiso correspondiente', () => {
  assert.equal(permissionForProductWrite('POST', '/productos'), 'PRODUCTOS_CREAR');
  assert.equal(permissionForProductWrite('PUT', '/variantes/12'), 'PRODUCTOS_EDITAR');
  assert.equal(permissionForProductWrite('PATCH', '/categorias/2/estado'), 'PRODUCTOS_EDITAR');
  assert.equal(permissionForProductWrite('GET', '/productos'), null);
});

test('usa el actor devuelto por users-service e ignora actor_usuario_id del cuerpo', async () => {
  let forwarded;
  global.fetch = async (url, options) => {
    forwarded = { url, options };
    return new Response(JSON.stringify({
      valid: true,
      user: { id: '17' },
    }), { status: 200 });
  };
  const middleware = createProductAuthorizationMiddleware({
    usersServiceUrl: 'http://users-service:4002',
    internalSecret: 'test-secret',
  });
  const req = {
    method: 'POST',
    path: '/productos',
    body: { actor_usuario_id: 99 },
    get: (name) => name === 'authorization' ? 'Bearer verified-token' : undefined,
  };
  const res = responseHarness();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(verifiedActorId(req), 17);
  assert.equal(forwarded.options.headers.authorization, 'Bearer verified-token');
  assert.deepEqual(JSON.parse(forwarded.options.body), { permission: 'PRODUCTOS_CREAR' });
  assert.equal(forwarded.url, 'http://users-service:4002/internal/auth/validate');
});

test('rechaza una mutación sin token aunque el cuerpo sugiera un actor', async () => {
  const middleware = createProductAuthorizationMiddleware({
    usersServiceUrl: 'http://users-service:4002',
    internalSecret: 'test-secret',
  });
  const req = {
    method: 'POST',
    path: '/variantes',
    body: { actor_usuario_id: 99 },
    get: () => undefined,
  };
  const res = responseHarness();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(verifiedActorId(req), null);
});
