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

function cumple(record, where) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some((item) => cumple(record, item));
    const actual = record[key];

    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof Date)
    ) {
      if ('in' in expected) return expected.in.includes(actual);
      if ('not' in expected) return actual !== expected.not;
      if ('lt' in expected) return actual < expected.lt;
      if ('gt' in expected) return actual > expected.gt;
    }

    return actual === expected;
  });
}

function aplicar(record, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      record[key] += value.increment;
    } else {
      record[key] = value;
    }
  }
}

function crearHarness({ detalles = 1, postMovimiento } = {}) {
  const venta = {
    id: 51n,
    estado: 'CONFIRMADA',
    detalle_ventas: Array.from({ length: detalles }, (_, index) => ({
      id: BigInt(801 + index),
      venta_id: 51n,
      variante_producto_id: BigInt(901 + index),
      cantidad: index + 2,
    })),
    pagos: [{ id: 71n, venta_id: 51n, estado: 'PAGADO' }],
  };
  const state = {
    venta,
    operacion: null,
    tareas: [],
    eventos: [],
    nextTaskId: 1n,
  };

  const db = {
    $transaction: (callback) => callback(db),
    $queryRaw: async () => [],
    operaciones_anulacion: {
      findUnique: async ({ where, include }) => {
        const operacion = where.id !== undefined
          ? state.operacion?.id === where.id ? state.operacion : null
          : state.operacion?.venta_id === where.venta_id
            ? state.operacion
            : null;
        if (!operacion || !include) return operacion;

        return {
          ...structuredClone(operacion),
          tareas: structuredClone(state.tareas),
          eventos: structuredClone(state.eventos),
        };
      },
      create: async ({ data }) => {
        if (state.operacion) {
          const error = new Error('Unique constraint');
          error.code = 'P2002';
          throw error;
        }

        state.operacion = {
          id: 601n,
          venta_id: data.venta_id,
          estado: data.estado,
          lease_token: null,
          lease_hasta: null,
          intentos: 0,
          ...Object.fromEntries(
            Object.entries(data).filter(([key]) =>
              !['tareas', 'eventos'].includes(key),
            ),
          ),
        };

        for (const tarea of data.tareas.create) {
          state.tareas.push({
            id: state.nextTaskId++,
            operacion_id: state.operacion.id,
            estado: 'PENDIENTE',
            intentos: 0,
            ...tarea,
          });
        }

        state.eventos.push({
          id: BigInt(state.eventos.length + 1),
          operacion_id: state.operacion.id,
          ...data.eventos.create,
        });
        return structuredClone(state.operacion);
      },
      updateMany: async ({ where, data }) => {
        if (!state.operacion || !cumple(state.operacion, where)) {
          return { count: 0 };
        }
        aplicar(state.operacion, data);
        return { count: 1 };
      },
    },
    tareas_anulacion: {
      findMany: async () => structuredClone(state.tareas),
      count: async ({ where }) =>
        state.tareas.filter((tarea) => cumple(tarea, where)).length,
      updateMany: async ({ where, data }) => {
        const matches = state.tareas.filter((tarea) => cumple(tarea, where));
        matches.forEach((tarea) => aplicar(tarea, data));
        return { count: matches.length };
      },
    },
    eventos_anulacion: {
      create: async ({ data }) => {
        const evento = {
          id: BigInt(state.eventos.length + 1),
          ...data,
        };
        state.eventos.push(evento);
        return evento;
      },
    },
    ventas: {
      findUnique: async () => structuredClone(state.venta),
      updateMany: async ({ where, data }) => {
        if (!cumple(state.venta, where)) return { count: 0 };
        aplicar(state.venta, data);
        return { count: 1 };
      },
    },
    pagos: {
      updateMany: async ({ where, data }) => {
        const matches = state.venta.pagos.filter((pago) =>
          cumple(pago, where),
        );
        matches.forEach((pago) => aplicar(pago, data));
        return { count: matches.length };
      },
    },
  };

  const handlers = new Map();
  const app = {
    get: (path, handler) => handlers.set(`GET ${path}`, handler),
    post: (path, handler) => handlers.set(`POST ${path}`, handler),
    patch: (path, handler) => handlers.set(`PATCH ${path}`, handler),
  };
  registrarRutasVentas(app, db);

  const call = async (key, body = {}) => {
    const handler = handlers.get(key);
    assert.ok(handler, `Falta el handler ${key}`);
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
    await handler(
      {
        params: { id: '51' },
        body,
        authenticatedUser: { id: '4' },
      },
      response,
    );
    return response;
  };

  const applied = new Map();
  const stock = new Map();
  const calls = [];
  process.env.SALES_INVENTORY_INTERNAL_SECRET = 'unit-test-secret';
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    let movement = applied.get(payload.idempotency_key);
    const repeated = Boolean(movement);

    if (!movement) {
      movement = { id: String(applied.size + 3001) };
      applied.set(payload.idempotency_key, movement);
      if (payload.tipo_movimiento === 'ENTRADA') {
        const variantId = payload.variante_producto_id;
        stock.set(variantId, (stock.get(variantId) || 0) + payload.cantidad);
      }
    }

    if (postMovimiento) {
      await postMovimiento({
        payload,
        repeated,
        movement,
        state,
      });
    }

    return new Response(JSON.stringify({
      movimiento: movement,
      repetido: repeated,
    }), {
      status: repeated ? 200 : 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return { call, state, applied, calls, stock };
}

test('anula la venta después de completar cada reversión de inventario', async () => {
  const harness = crearHarness({ detalles: 2 });

  const result = await harness.call('PATCH /ventas/:id/estado', {
    estado: 'ANULADA',
  });

  assert.equal(result.statusCode, 200);
  assert.equal(harness.state.operacion.estado, 'COMPLETADA');
  assert.equal(harness.state.venta.estado, 'ANULADA');
  assert.ok(harness.state.venta.pagos.every((pago) => pago.estado === 'ANULADO'));
  assert.equal(harness.state.tareas.length, 2);
  assert.ok(harness.state.tareas.every((tarea) => tarea.estado === 'COMPLETADA'));
  assert.equal(harness.stock.get('901'), 2);
  assert.equal(harness.stock.get('902'), 3);
  assert.ok(
    harness.state.tareas.every(
      (tarea) => tarea.movimiento_inventario_id !== undefined,
    ),
  );
  assert.deepEqual(
    harness.calls.map((call) => call.idempotency_key),
    [
      'VENTA:51:DETALLE:801:ANULACION',
      'VENTA:51:DETALLE:802:ANULACION',
    ],
  );

  const repeated = await harness.call('PATCH /ventas/:id/estado', {
    estado: 'ANULADA',
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(harness.calls.length, 2);
});

test('un timeout posterior al movimiento conserva la clave y permite recuperar sin duplicar', async () => {
  let timeoutOnce = true;
  const harness = crearHarness({
    postMovimiento: async () => {
      if (timeoutOnce) {
        timeoutOnce = false;
        const error = new Error('simulated timeout after commit');
        error.name = 'TimeoutError';
        throw error;
      }
    },
  });

  const first = await harness.call('PATCH /ventas/:id/estado', {
    estado: 'ANULADA',
  });
  assert.equal(first.statusCode, 202);
  assert.equal(harness.state.tareas[0].estado, 'REINTENTABLE');
  assert.equal(harness.state.venta.estado, 'CONFIRMADA');

  const retry = await harness.call(
    'POST /ventas/:id/anulacion/reintentar',
  );
  assert.equal(retry.statusCode, 200);
  assert.equal(harness.state.operacion.estado, 'COMPLETADA');
  assert.equal(harness.state.venta.estado, 'ANULADA');
  assert.equal(harness.applied.size, 1);
  assert.equal(harness.stock.get('901'), 2);
  assert.equal(harness.calls.length, 2);
  assert.equal(
    harness.calls[0].idempotency_key,
    harness.calls[1].idempotency_key,
  );
});

test('un trabajador que pierde el lease no completa ni reintenta la tarea', async () => {
  const harness = crearHarness({
    postMovimiento: async ({ state }) => {
      state.operacion.lease_token = 'new-owner';
      state.operacion.lease_hasta = new Date(Date.now() + 60000);
    },
  });

  const result = await harness.call('PATCH /ventas/:id/estado', {
    estado: 'ANULADA',
  });

  assert.equal(result.statusCode, 202);
  assert.equal(harness.state.operacion.estado, 'EN_PROCESO');
  assert.equal(harness.state.operacion.lease_token, 'new-owner');
  assert.equal(harness.state.tareas[0].estado, 'EN_PROCESO');
  assert.equal(harness.state.venta.estado, 'CONFIRMADA');
  assert.equal(
    harness.state.eventos.some(
      (evento) => evento.tipo_evento === 'REVERSA_INVENTARIO_FALLIDA',
    ),
    false,
  );
});

test('dos solicitudes simultáneas reclaman una única operación y una reversión', async () => {
  const harness = crearHarness();

  const results = await Promise.all([
    harness.call('PATCH /ventas/:id/estado', { estado: 'ANULADA' }),
    harness.call('PATCH /ventas/:id/estado', { estado: 'ANULADA' }),
  ]);

  assert.equal(harness.state.operacion.estado, 'COMPLETADA');
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.applied.size, 1);
  assert.ok(results.every((result) => [200, 202].includes(result.statusCode)));
});

test('reclama una operación EN_PROCESO cuyo lease ya venció', async () => {
  const harness = crearHarness();
  harness.state.operacion = {
    id: 601n,
    venta_id: 51n,
    estado: 'EN_PROCESO',
    lease_token: 'expired-owner',
    lease_hasta: new Date(Date.now() - 1000),
    intentos: 1,
  };
  harness.state.tareas.push({
    id: 1n,
    operacion_id: 601n,
    detalle_venta_id: 801n,
    variante_producto_id: 901n,
    cantidad: 2,
    estado: 'REINTENTABLE',
    idempotency_key: 'VENTA:51:DETALLE:801:ANULACION',
    intentos: 1,
  });

  const result = await harness.call(
    'POST /ventas/:id/anulacion/reintentar',
  );

  assert.equal(result.statusCode, 200);
  assert.equal(harness.state.operacion.estado, 'COMPLETADA');
  assert.equal(harness.state.tareas[0].estado, 'COMPLETADA');
  assert.equal(harness.state.operacion.intentos, 2);
  assert.equal(harness.calls[0].idempotency_key, 'VENTA:51:DETALLE:801:ANULACION');
});
