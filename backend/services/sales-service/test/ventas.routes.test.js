const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const registrarRutasVentas = require('../src/ventas.routes');

const originalFetch = global.fetch;
const originalSecret = process.env.SALES_INVENTORY_INTERNAL_SECRET;

afterEach(() => {
  global.fetch = originalFetch;

  if (originalSecret === undefined) {
    delete process.env.SALES_INVENTORY_INTERNAL_SECRET;
  } else {
    process.env.SALES_INVENTORY_INTERNAL_SECRET = originalSecret;
  }
});

function crearHarness({ errorPago = null } = {}) {
  const state = {
    venta: null,
    pagos: [],
    movimientos: [],
    authorizationHeaders: [],
    ventasCreadas: 0,
  };

  const prisma = {
    clientes: {
      findUnique: async () => null,
    },

    ventas: {
      create: async ({ data }) => {
        state.ventasCreadas += 1;

        state.venta = {
          id: 100n,
          cliente_id: data.cliente_id,
          fecha_venta: data.fecha_venta,
          estado: data.estado,
          subtotal: data.subtotal,
          total: data.total,
          detalle_ventas: data.detalle_ventas.create.map((detalle, index) => ({
            id: BigInt(201 + index),
            venta_id: 100n,
            ...detalle,
          })),
          clientes: null,
          pagos: [],
        };

        return structuredClone(state.venta);
      },

      update: async ({ data }) => {
        assert.ok(state.venta, 'Debe existir una venta antes de actualizarla');
        Object.assign(state.venta, data);
        return structuredClone(state.venta);
      },

      findUnique: async () => structuredClone(state.venta),
    },

    pagos: {
      create: async ({ data }) => {
        if (errorPago) throw errorPago;

        const pago = {
          id: BigInt(301 + state.pagos.length),
          ...data,
        };

        state.pagos.push(pago);
        state.venta.pagos.push(pago);

        return structuredClone(pago);
      },
    },
  };

  const handlers = new Map();
  const app = {
    get: (path, handler) => handlers.set(`GET ${path}`, handler),
    post: (path, handler) => handlers.set(`POST ${path}`, handler),
    patch: (path, handler) => handlers.set(`PATCH ${path}`, handler),
  };

  registrarRutasVentas(app, prisma);

  process.env.SALES_INVENTORY_INTERNAL_SECRET = 'test-secret';

  global.fetch = async (_url, options) => {
    const movimiento = JSON.parse(options.body);
    state.movimientos.push(movimiento);
    state.authorizationHeaders.push(options.headers.authorization || null);

    return new Response(
      JSON.stringify({
        movimiento: { id: String(401 + state.movimientos.length) },
        repetido: false,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  };

  async function call(body, { authorization, authenticatedUser } = {}) {
    const handler = handlers.get('POST /ventas');
    assert.ok(handler, 'No se registró POST /ventas');

    const response = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };

    await handler({
      body,
      authenticatedUser,
      headers: authorization ? { authorization } : {},
    }, response);
    return response;
  }

  return { call, state };
}

const ventaBase = {
  detalles: [
    {
      variante_producto_id: '901',
      cantidad: 2,
      precio_unitario: 10,
    },
  ],
};

test('rechaza un pago superior al total antes de crear la venta o descontar stock', async () => {
  const harness = crearHarness();

  const response = await harness.call({
    ...ventaBase,
    pago: {
      metodo_pago: 'EFECTIVO',
      monto: 25,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(harness.state.ventasCreadas, 0);
  assert.equal(harness.state.movimientos.length, 0);
  assert.equal(harness.state.pagos.length, 0);
});

test('crea una venta válida, descuenta inventario y registra el pago', async () => {
  const harness = crearHarness();

  const response = await harness.call({
    ...ventaBase,
    actor_usuario_id: 999,
    pago: {
      metodo_pago: 'EFECTIVO',
      monto: 20,
    },
  }, {
    authorization: 'Bearer token-verified-at-users-service',
    authenticatedUser: { id: '7' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(harness.state.ventasCreadas, 1);
  assert.equal(harness.state.movimientos.length, 1);
  assert.equal(harness.state.venta.estado, 'CONFIRMADA');
  assert.equal(harness.state.pagos.length, 1);
  assert.equal(harness.state.pagos[0].estado, 'PAGADO');
  assert.equal(Number(harness.state.pagos[0].monto), 20);
  assert.equal(harness.state.movimientos[0].actor_usuario_id, undefined);
  assert.equal(
    harness.state.authorizationHeaders[0],
    'Bearer token-verified-at-users-service',
  );
});

test('un fallo al registrar el pago no debe anular una venta cuyo inventario ya fue descontado', async () => {
  const harness = crearHarness({
    errorPago: new Error('Fallo simulado al guardar el pago'),
  });

  const response = await harness.call({
    ...ventaBase,
    pago: {
      metodo_pago: 'EFECTIVO',
      monto: 20,
    },
  });

  assert.equal(response.statusCode, 500);
  assert.equal(harness.state.ventasCreadas, 1);
  assert.equal(harness.state.movimientos.length, 1);
  assert.equal(harness.state.venta.estado, 'CONFIRMADA');
  assert.equal(harness.state.pagos.length, 0);
  assert.equal(response.body.venta_id, '100');
  assert.equal(response.body.estado, 'CONFIRMADA');
  assert.equal(response.body.requiere_verificacion_pago, true);
});
