const assert = require('node:assert/strict');
const fs = require('node:fs');
const mariadb = require('mariadb');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const SALES_URL = 'http://127.0.0.1:4005';
const INVENTORY_URL = 'http://inventory-service:4004';
const PROXY_CONTROL_URL = 'http://inventory-proxy:4011/__test/control';
const ADMIN_TOKEN = 'integration-admin-token';
const READER_TOKEN = 'integration-reader-token';
const restartStateFile = '/tmp/annulment-integration-restart-case.json';
let variantSequence = 0n;

function createClient(connectionString) {
  const url = new URL(connectionString);
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
    }),
  });
}

const sales = createClient(process.env.DATABASE_URL);
const inventoryUrl = new URL(process.env.INTEGRATION_INVENTORY_DATABASE_URL);
const inventoryPool = mariadb.createPool({
  host: inventoryUrl.hostname,
  port: Number(inventoryUrl.port || 3306),
  user: decodeURIComponent(inventoryUrl.username),
  password: decodeURIComponent(inventoryUrl.password),
  database: inventoryUrl.pathname.slice(1),
  connectionLimit: 2,
});

const inventory = {
  query: (sql, values = []) => inventoryPool.query(sql, values),
  existencias: {
    create: async ({ data }) => inventoryPool.query(
      `INSERT INTO existencias
        (variante_producto_id, cantidad, cantidad_minima, actualizado_en)
       VALUES (?, ?, ?, ?)`,
      [
        data.variante_producto_id,
        data.cantidad,
        data.cantidad_minima,
        data.actualizado_en,
      ],
    ),
    findUnique: async ({ where }) => {
      const rows = await inventoryPool.query(
        'SELECT * FROM existencias WHERE variante_producto_id = ?',
        [where.variante_producto_id],
      );
      return rows[0] || null;
    },
  },
  movimientos_inventario: {
    findUnique: async ({ where }) => {
      const rows = await inventoryPool.query(
        'SELECT * FROM movimientos_inventario WHERE idempotency_key = ?',
        [where.idempotency_key],
      );
      return rows[0] || null;
    },
    findMany: async ({ where }) => {
      if (where.idempotency_key?.startsWith) {
        return inventoryPool.query(
          'SELECT * FROM movimientos_inventario WHERE idempotency_key LIKE CONCAT(?, CHAR(37)) ORDER BY id',
          [where.idempotency_key.startsWith],
        );
      }
      return inventoryPool.query(
        `SELECT * FROM movimientos_inventario
         WHERE referencia_tipo = ? AND referencia_id = ? ORDER BY id`,
        [where.referencia_tipo, where.referencia_id],
      );
    },
    count: async ({ where }) => {
      const rows = await inventoryPool.query(
        'SELECT COUNT(*) AS total FROM movimientos_inventario WHERE idempotency_key = ?',
        [where.idempotency_key],
      );
      return Number(rows[0].total);
    },
  },
  $disconnect: () => inventoryPool.end(),
};

async function request(url, { method = 'GET', body, token = ADMIN_TOKEN, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload };
}

async function salesRequest(method, path, options = {}) {
  return request(`${SALES_URL}${path}`, { ...options, method });
}

async function armProxy(mode, variantId) {
  const response = await request(PROXY_CONTROL_URL, {
    method: 'POST',
    headers: {
      'x-test-control-secret': process.env.INTERNAL_SERVICE_SECRET,
    },
    body: {
      mode,
      ...(variantId === undefined ? {} : { variantId: String(variantId) }),
    },
  });
  assert.equal(response.status, 200, 'test proxy must accept a fault instruction');
}

async function waitForMovement(key, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const movement = await inventory.movimientos_inventario.findUnique({
      where: { idempotency_key: key },
    });
    if (movement) return movement;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Inventory did not persist the expected idempotency key.');
}

async function waitForSalesService(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`${SALES_URL}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Sales service did not become available after restart.');
}

async function assertIsolatedDatabases() {
  assert.ok(process.env.DATABASE_URL, 'sales test DATABASE_URL is required');
  assert.ok(
    process.env.INTEGRATION_INVENTORY_DATABASE_URL,
    'inventory test URL is required',
  );
  assert.ok(
    process.env.SALES_INVENTORY_INTERNAL_SECRET,
    'test inventory secret is required',
  );
  assert.ok(
    process.env.INTERNAL_SERVICE_SECRET,
    'test authorization secret is required',
  );

  const [salesIdentity] = await sales.$queryRaw`
    SELECT DATABASE() AS database_name, @@hostname AS hostname,
      @@global.read_only AS read_only
  `;
  const inventoryIdentityRows = await inventory.query(
    `SELECT DATABASE() AS database_name, @@hostname AS hostname,
      @@global.read_only AS read_only`,
  );
  const inventoryIdentity = inventoryIdentityRows[0];
  assert.equal(salesIdentity.database_name, 'boutique_sales');
  assert.equal(inventoryIdentity.database_name, 'boutique_inventory');
  assert.match(salesIdentity.hostname, /^[a-f0-9]{12}$/);
  assert.match(inventoryIdentity.hostname, /^[a-f0-9]{12}$/);
  assert.equal(Number(salesIdentity.read_only), 0);
  assert.equal(Number(inventoryIdentity.read_only), 0);

  const indexRows = await inventory.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'movimientos_inventario'
      AND index_name = 'uq_movimientos_idempotency_key'
      AND non_unique = 0
  `);
  assert.equal(Number(indexRows[0].total), 1);

  const timestampRows = await sales.$queryRaw`
    SELECT column_name, extra
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name IN ('operaciones_anulacion', 'tareas_anulacion')
      AND column_name = 'actualizada_en'
  `;
  assert.equal(timestampRows.length, 2);
  assert.ok(timestampRows.every((row) => !String(row.extra).toLowerCase().includes('on update')));
}

async function createFixture(lines, label) {
  const now = new Date();
  const preparedLines = [];

  for (const line of lines) {
    variantSequence += 1n;
    const variantId = BigInt(Date.now()) * 100000n + variantSequence;
    await inventory.existencias.create({
      data: {
        variante_producto_id: variantId,
        cantidad: line.stock,
        cantidad_minima: 0,
        actualizado_en: now,
      },
    });
    preparedLines.push({
      ...line,
      variantId,
    });
  }

  const total = Number(preparedLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  ).toFixed(2));
  const sale = await sales.ventas.create({
    data: {
      cliente_id: null,
      fecha_venta: now,
      estado: 'CONFIRMADA',
      subtotal: total,
      total,
      creado_en: now,
      actualizado_en: now,
      detalle_ventas: {
        create: preparedLines.map((line) => ({
          variante_producto_id: line.variantId,
          cantidad: line.quantity,
          precio_unitario: line.unitPrice,
          subtotal: Number((line.quantity * line.unitPrice).toFixed(2)),
        })),
      },
      pagos: {
        create: {
          metodo_pago: 'EFECTIVO',
          monto: total,
          estado: 'PAGADO',
          fecha_pago: now,
          creado_en: now,
          actualizado_en: now,
        },
      },
    },
    include: { detalle_ventas: true, pagos: true },
  });

  return {
    label,
    sale,
    lines: preparedLines.map((line, index) => ({
      ...line,
      detailId: sale.detalle_ventas[index].id,
      idempotencyKey:
        `VENTA:${sale.id}:DETALLE:${sale.detalle_ventas[index].id}:ANULACION`,
    })),
  };
}

async function readFixture(fixture) {
  const sale = await sales.ventas.findUnique({
    where: { id: fixture.sale.id },
    include: { pagos: true },
  });
  const operation = await sales.operaciones_anulacion.findUnique({
    where: { venta_id: fixture.sale.id },
    include: {
      tareas: { orderBy: { id: 'asc' } },
      eventos: { orderBy: { creado_en: 'asc' } },
    },
  });
  const stocks = await Promise.all(fixture.lines.map((line) =>
    inventory.existencias.findUnique({
      where: { variante_producto_id: line.variantId },
    }),
  ));
  const movements = await inventory.movimientos_inventario.findMany({
    where: {
      referencia_tipo: 'VENTA',
      referencia_id: fixture.sale.id,
    },
    orderBy: { id: 'asc' },
  });
  return { sale, operation, stocks, movements };
}

function assertCompletedSnapshot(fixture, snapshot) {
  assert.ok(snapshot.sale);
  assert.equal(snapshot.sale.estado, 'ANULADA');
  assert.ok(snapshot.sale.pagos.every((payment) => payment.estado === 'ANULADO'));
  assert.ok(snapshot.operation);
  assert.equal(snapshot.operation.estado, 'COMPLETADA');
  assert.equal(snapshot.operation.tareas.length, fixture.lines.length);
  assert.ok(snapshot.operation.tareas.every((task) => task.estado === 'COMPLETADA'));
  assert.equal(snapshot.operation.eventos.at(-1).tipo_evento, 'ANULACION_COMPLETADA');
  assert.equal(snapshot.movements.length, fixture.lines.length);

  fixture.lines.forEach((line, index) => {
    assert.equal(
      Number(snapshot.stocks[index].cantidad),
      line.stock + line.quantity,
      `stock for variant ${line.variantId} must increase exactly once`,
    );
    const task = snapshot.operation.tareas.find(
      (item) => item.detalle_venta_id === line.detailId,
    );
    assert.ok(task);
    assert.equal(task.idempotency_key, line.idempotencyKey);
    assert.equal(task.movimiento_inventario_id.toString(),
      snapshot.movements.find((movement) =>
        movement.idempotency_key === line.idempotencyKey,
      ).id.toString());
    assert.equal(
      snapshot.movements.filter((movement) =>
        movement.idempotency_key === line.idempotencyKey,
      ).length,
      1,
    );
  });
}

async function runCase(name, callback, results) {
  try {
    await callback();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function testCore() {
  const results = [];
  let single;
  let multi;
  let partial;

  await runCase('1 anulación normal de una línea', async () => {
    single = await createFixture(
      [{ stock: 8, quantity: 3, unitPrice: 20 }],
      'normal-one-line',
    );
    const response = await salesRequest('PATCH', `/ventas/${single.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.payload.anulacion.estado, 'COMPLETADA');
    assertCompletedSnapshot(single, await readFixture(single));
  }, results);

  await runCase('2 anulación de múltiples detalles', async () => {
    multi = await createFixture([
      { stock: 10, quantity: 2, unitPrice: 15 },
      { stock: 4, quantity: 1, unitPrice: 25 },
      { stock: 8, quantity: 4, unitPrice: 5 },
    ], 'multiple-details');
    const response = await salesRequest('PATCH', `/ventas/${multi.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    assert.equal(response.status, 200);
    assertCompletedSnapshot(multi, await readFixture(multi));
  }, results);

  await runCase('3 repetir solicitud completada sin duplicar', async () => {
    assert.ok(single);
    const before = await readFixture(single);
    const response = await salesRequest('PATCH', `/ventas/${single.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    const after = await readFixture(single);
    assert.equal(response.status, 200);
    assert.equal(after.operation.id, before.operation.id);
    assert.equal(after.movements.length, before.movements.length);
    assert.deepEqual(after.stocks.map((row) => row.cantidad),
      before.stocks.map((row) => row.cantidad));
  }, results);

  await runCase('4 clave idempotente repetida y payload conflictivo', async () => {
    const fixture = await createFixture(
      [{ stock: 6, quantity: 2, unitPrice: 10 }],
      'direct-idempotency',
    );
    const line = fixture.lines[0];
    const payload = {
      variante_producto_id: String(line.variantId),
      tipo_movimiento: 'ENTRADA',
      cantidad: 2,
      referencia_tipo: 'VENTA',
      referencia_id: String(fixture.sale.id),
      motivo: `Reversión sintética ${fixture.sale.id}`,
      idempotency_key: `IT-DIRECT:${fixture.sale.id}:${line.variantId}`,
    };
    const post = (body, secret = process.env.SALES_INVENTORY_INTERNAL_SECRET) =>
      request(`${INVENTORY_URL}/internal/ventas/movimientos`, {
        method: 'POST',
        headers: secret
          ? { 'x-sales-inventory-secret': secret }
          : {},
        body,
        token: null,
      });
    const first = await post(payload);
    const second = await post(payload);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.payload.repetido, true);
    assert.equal(first.payload.movimiento.id, second.payload.movimiento.id);
    assert.equal(
      Number((await inventory.existencias.findUnique({
        where: { variante_producto_id: line.variantId },
      })).cantidad),
      8,
    );
    const conflict = await post({ ...payload, cantidad: 3 });
    assert.equal(conflict.status, 409);
    const movementCount = await inventory.movimientos_inventario.count({
      where: { idempotency_key: payload.idempotency_key },
    });
    assert.equal(movementCount, 1);
  }, results);

  await runCase('5 timeout después del commit y recuperación idempotente', async () => {
    const fixture = await createFixture(
      [{ stock: 5, quantity: 4, unitPrice: 7 }],
      'timeout-after-commit',
    );
    await armProxy('timeout_after_commit');
    const initial = await salesRequest('PATCH', `/ventas/${fixture.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    assert.equal(initial.status, 202);
    let snapshot = await readFixture(fixture);
    assert.equal(snapshot.sale.estado, 'CONFIRMADA');
    assert.equal(snapshot.sale.pagos[0].estado, 'PAGADO');
    assert.equal(snapshot.operation.estado, 'REINTENTABLE');
    assert.equal(snapshot.operation.tareas[0].estado, 'REINTENTABLE');
    const retry = await salesRequest(
      'POST',
      `/ventas/${fixture.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    assert.equal(retry.status, 200);
    snapshot = await readFixture(fixture);
    assertCompletedSnapshot(fixture, snapshot);
    assert.ok(snapshot.operation.eventos.some(
      (event) => event.tipo_evento === 'REVERSA_IDEMPOTENTE_RECONOCIDA',
    ));
  }, results);

  await runCase('6 pérdida del lease durante el timeout y recuperación por nuevo propietario', async () => {
    const fixture = await createFixture(
      [{ stock: 3, quantity: 2, unitPrice: 9 }],
      'lease-loss-in-flight',
    );
    await armProxy('timeout_after_commit');
    const firstRequest = salesRequest('PATCH', `/ventas/${fixture.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    await waitForMovement(fixture.lines[0].idempotencyKey);
    await sales.operaciones_anulacion.update({
      where: { venta_id: fixture.sale.id },
      data: {
        lease_token: 'integration-stolen-lease',
        lease_hasta: new Date(Date.now() - 1000),
      },
    });
    const retry = await salesRequest(
      'POST',
      `/ventas/${fixture.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    assert.equal(retry.status, 200);
    await firstRequest;
    assertCompletedSnapshot(fixture, await readFixture(fixture));
  }, results);

  await runCase('7 recuperación de operación con lease vencido', async () => {
    const fixture = await createFixture(
      [{ stock: 7, quantity: 3, unitPrice: 4 }],
      'expired-lease',
    );
    const operation = await sales.operaciones_anulacion.create({
      data: {
        venta_id: fixture.sale.id,
        estado: 'EN_PROCESO',
        lease_token: 'integration-expired-token',
        lease_hasta: new Date(Date.now() - 5000),
        tareas: {
          create: fixture.lines.map((line) => ({
            detalle_venta_id: line.detailId,
            variante_producto_id: line.variantId,
            cantidad: line.quantity,
            estado: 'EN_PROCESO',
            idempotency_key: line.idempotencyKey,
          })),
        },
        eventos: {
          create: {
            tipo_evento: 'ANULACION_INICIADA',
            estado_anterior: 'PENDIENTE',
            estado_nuevo: 'EN_PROCESO',
            mensaje: 'Fixture sintética de lease vencido.',
          },
        },
      },
    });
    assert.ok(operation.id);
    const response = await salesRequest(
      'POST',
      `/ventas/${fixture.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    assert.equal(response.status, 200);
    assertCompletedSnapshot(fixture, await readFixture(fixture));
  }, results);

  await runCase('8 solicitudes concurrentes no duplican operación ni reversión', async () => {
    const fixture = await createFixture(
      [{ stock: 9, quantity: 5, unitPrice: 3 }],
      'concurrent-requests',
    );
    const responses = await Promise.all([
      salesRequest('PATCH', `/ventas/${fixture.sale.id}/estado`, {
        body: { estado: 'ANULADA' },
      }),
      salesRequest('PATCH', `/ventas/${fixture.sale.id}/estado`, {
        body: { estado: 'ANULADA' },
      }),
    ]);
    assert.ok(responses.every((response) => [200, 202].includes(response.status)));
    const snapshot = await readFixture(fixture);
    assert.equal(await sales.operaciones_anulacion.count({
      where: { venta_id: fixture.sale.id },
    }), 1);
    assertCompletedSnapshot(fixture, snapshot);
  }, results);

  await runCase('9 error temporal de inventario y reintento recuperable', async () => {
    const fixture = await createFixture(
      [{ stock: 2, quantity: 6, unitPrice: 8 }],
      'transient-failure',
    );
    await armProxy('fail_before_commit');
    const initial = await salesRequest('PATCH', `/ventas/${fixture.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    assert.equal(initial.status, 202);
    let snapshot = await readFixture(fixture);
    assert.equal(snapshot.sale.estado, 'CONFIRMADA');
    assert.equal(snapshot.sale.pagos[0].estado, 'PAGADO');
    assert.equal(snapshot.operation.estado, 'REINTENTABLE');
    assert.equal(snapshot.operation.tareas[0].estado, 'REINTENTABLE');
    assert.equal(snapshot.movements.length, 0);
    assert.equal(Number(snapshot.stocks[0].cantidad), 2);
    const retry = await salesRequest(
      'POST',
      `/ventas/${fixture.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    assert.equal(retry.status, 200);
    snapshot = await readFixture(fixture);
    assertCompletedSnapshot(fixture, snapshot);
  }, results);

  await runCase('10 reintento de operación completada no hace nuevos movimientos', async () => {
    assert.ok(single);
    const before = await readFixture(single);
    const response = await salesRequest(
      'POST',
      `/ventas/${single.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    const after = await readFixture(single);
    assert.equal(response.status, 409);
    assert.equal(after.movements.length, before.movements.length);
    assert.deepEqual(after.stocks.map((row) => row.cantidad),
      before.stocks.map((row) => row.cantidad));
  }, results);

  await runCase('11 secreto interno incorrecto o ausente es rechazado', async () => {
    const fixture = await createFixture(
      [{ stock: 11, quantity: 1, unitPrice: 12 }],
      'internal-auth',
    );
    const line = fixture.lines[0];
    const payload = {
      variante_producto_id: String(line.variantId),
      tipo_movimiento: 'ENTRADA',
      cantidad: 1,
      referencia_tipo: 'VENTA',
      referencia_id: String(fixture.sale.id),
      motivo: 'Prueba de autorización interna',
      idempotency_key: `IT-UNAUTH:${fixture.sale.id}`,
    };
    for (const secret of [undefined, 'wrong-integration-secret']) {
      const response = await request(
        `${INVENTORY_URL}/internal/ventas/movimientos`,
        {
          method: 'POST',
          token: null,
          headers: secret
            ? { 'x-sales-inventory-secret': secret }
            : {},
          body: payload,
        },
      );
      assert.equal(response.status, 401);
    }
    assert.equal(await inventory.movimientos_inventario.count({
      where: { idempotency_key: payload.idempotency_key },
    }), 0);
    assert.equal(Number((await inventory.existencias.findUnique({
      where: { variante_producto_id: line.variantId },
    })).cantidad), 11);
  }, results);

  await runCase('12-13 fallo parcial conserva venta/pagos y no finaliza antes de reintentar', async () => {
    partial = await createFixture([
      { stock: 4, quantity: 2, unitPrice: 13 },
      { stock: 5, quantity: 3, unitPrice: 17 },
      { stock: 6, quantity: 4, unitPrice: 11 },
    ], 'partial-failure');
    await armProxy('fail_before_commit', partial.lines[1].variantId);
    const initial = await salesRequest('PATCH', `/ventas/${partial.sale.id}/estado`, {
      body: { estado: 'ANULADA' },
    });
    assert.equal(initial.status, 202);
    let snapshot = await readFixture(partial);
    assert.equal(snapshot.sale.estado, 'CONFIRMADA');
    assert.ok(snapshot.sale.pagos.every((payment) => payment.estado === 'PAGADO'));
    assert.equal(snapshot.operation.estado, 'REINTENTABLE');
    assert.deepEqual(snapshot.operation.tareas.map((task) => task.estado),
      ['COMPLETADA', 'REINTENTABLE', 'COMPLETADA']);
    assert.equal(snapshot.movements.length, 2);
    assert.equal(Number(snapshot.stocks[1].cantidad), partial.lines[1].stock);
    const retry = await salesRequest(
      'POST',
      `/ventas/${partial.sale.id}/anulacion/reintentar`,
      { body: {} },
    );
    assert.equal(retry.status, 200);
    snapshot = await readFixture(partial);
    assertCompletedSnapshot(partial, snapshot);
  }, results);

  await runCase('14 stock, claves y movimientos coinciden exactamente', async () => {
    assert.ok(multi && partial);
    assertCompletedSnapshot(multi, await readFixture(multi));
    assertCompletedSnapshot(partial, await readFixture(partial));
    const directEntries = await inventory.movimientos_inventario.findMany({
      where: { idempotency_key: { startsWith: 'IT-DIRECT:' } },
    });
    assert.ok(directEntries.length >= 1);
    assert.equal(directEntries.length, new Set(
      directEntries.map((movement) => movement.idempotency_key),
    ).size);
  }, results);

  await runCase('15 auditoría persistida refleja tareas, estados y reintentos', async () => {
    assert.ok(partial);
    const snapshot = await readFixture(partial);
    assertCompletedSnapshot(partial, snapshot);
    assert.ok(snapshot.operation.eventos.some(
      (event) => event.tipo_evento === 'REVERSA_INVENTARIO_FALLIDA',
    ));
    assert.ok(snapshot.operation.eventos.some(
      (event) => event.tipo_evento === 'ANULACION_PENDIENTE_REINTENTO',
    ));
    assert.ok(snapshot.operation.eventos.some(
      (event) => event.tipo_evento === 'ANULACION_COMPLETADA',
    ));
    const status = await salesRequest(
      'GET',
      `/ventas/${partial.sale.id}/anulacion`,
    );
    assert.equal(status.status, 200);
    assert.equal(status.payload.estado, 'COMPLETADA');
    assert.equal(status.payload.tareas.length, 3);
  }, results);

  await runCase('autorización comercial: token ausente, permiso lector y permiso insuficiente', async () => {
    assert.ok(single);
    const unauthenticated = await salesRequest(
      'GET',
      `/ventas/${single.sale.id}/anulacion`,
      { token: null },
    );
    assert.equal(unauthenticated.status, 401);
    const reader = await salesRequest(
      'GET',
      `/ventas/${single.sale.id}/anulacion`,
      { token: READER_TOKEN },
    );
    assert.equal(reader.status, 200);
    const forbidden = await salesRequest(
      'PATCH',
      `/ventas/${single.sale.id}/estado`,
      { token: READER_TOKEN, body: { estado: 'PENDIENTE' } },
    );
    assert.equal(forbidden.status, 403);
  }, results);

  await runCase('estados, IDs, importes y ventas inexistentes se validan', async () => {
    assert.ok(single);
    assert.equal((await salesRequest('GET', '/ventas/not-a-number')).status, 400);
    assert.equal((await salesRequest('GET', '/ventas/999999999999999999')).status, 404);
    assert.equal((await salesRequest('PATCH', '/ventas/999999999999999999/estado', {
      body: { estado: 'ANULADA' },
    })).status, 404);
    assert.equal((await salesRequest('GET', '/ventas/999999999999999999/anulacion')).status, 404);
    assert.equal((await salesRequest('POST', '/ventas/999999999999999999/anulacion/reintentar', {
      body: {},
    })).status, 404);
    assert.equal((await salesRequest('PATCH', `/ventas/${single.sale.id}/estado`, {
      body: { estado: 'INVALIDO' },
    })).status, 400);

    const saleCountBefore = await sales.ventas.count();
    const invalidSale = await salesRequest('POST', '/ventas', {
      body: {
        detalles: [{
          variante_producto_id: String(single.lines[0].variantId),
          cantidad: 0,
          precio_unitario: -1,
        }],
      },
    });
    assert.equal(invalidSale.status, 400);
    assert.equal(await sales.ventas.count(), saleCountBefore);

    const reasonFixture = await createFixture(
      [{ stock: 10, quantity: 1, unitPrice: 4 }],
      'invalid-reason',
    );
    const invalidReason = await salesRequest(
      'PATCH',
      `/ventas/${reasonFixture.sale.id}/estado`,
      { body: { estado: 'ANULADA', motivo: 'x'.repeat(501) } },
    );
    assert.equal(invalidReason.status, 400);
    assert.equal((await readFixture(reasonFixture)).operation, null);
  }, results);

  await sales.$disconnect();
  await inventory.$disconnect();
  const failed = results.filter((result) => !result.passed);
  console.log(`INTEGRATION SUMMARY: ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exitCode = 1;
}

async function prepareRestartCase() {
  await assertIsolatedDatabases();
  const fixture = await createFixture(
    [{ stock: 12, quantity: 2, unitPrice: 14 }],
    'service-restart',
  );
  await armProxy('fail_before_commit');
  const response = await salesRequest(
    'PATCH',
    `/ventas/${fixture.sale.id}/estado`,
    { body: { estado: 'ANULADA' } },
  );
  assert.equal(response.status, 202);
  const snapshot = await readFixture(fixture);
  assert.equal(snapshot.operation.estado, 'REINTENTABLE');
  assert.equal(snapshot.operation.tareas[0].estado, 'REINTENTABLE');
  assert.equal(snapshot.sale.estado, 'CONFIRMADA');
  fs.writeFileSync(restartStateFile, JSON.stringify({
    saleId: fixture.sale.id.toString(),
    variantId: fixture.lines[0].variantId.toString(),
    detailId: fixture.lines[0].detailId.toString(),
    quantity: fixture.lines[0].quantity,
    stock: fixture.lines[0].stock,
    key: fixture.lines[0].idempotencyKey,
  }));
  console.log('PASS: incomplete operation persisted; ready for isolated sales-service restart.');
  await sales.$disconnect();
  await inventory.$disconnect();
}

async function finishRestartCase() {
  await assertIsolatedDatabases();
  await waitForSalesService();
  const state = JSON.parse(fs.readFileSync(restartStateFile, 'utf8'));
  const before = await sales.operaciones_anulacion.findUnique({
    where: { venta_id: BigInt(state.saleId) },
    include: { tareas: true },
  });
  assert.equal(before.estado, 'REINTENTABLE');
  assert.equal(before.tareas[0].estado, 'REINTENTABLE');

  const response = await salesRequest(
    'POST',
    `/ventas/${state.saleId}/anulacion/reintentar`,
    { body: {} },
  );
  assert.equal(response.status, 200);
  const sale = await sales.ventas.findUnique({
    where: { id: BigInt(state.saleId) },
    include: { pagos: true },
  });
  const operation = await sales.operaciones_anulacion.findUnique({
    where: { venta_id: BigInt(state.saleId) },
    include: { tareas: true, eventos: true },
  });
  const existence = await inventory.existencias.findUnique({
    where: { variante_producto_id: BigInt(state.variantId) },
  });
  const movementCount = await inventory.movimientos_inventario.count({
    where: { idempotency_key: state.key },
  });
  assert.equal(sale.estado, 'ANULADA');
  assert.ok(sale.pagos.every((payment) => payment.estado === 'ANULADO'));
  assert.equal(operation.estado, 'COMPLETADA');
  assert.equal(operation.tareas[0].estado, 'COMPLETADA');
  assert.equal(Number(existence.cantidad), state.stock + state.quantity);
  assert.equal(movementCount, 1);
  assert.ok(operation.eventos.some(
    (event) => event.tipo_evento === 'ANULACION_COMPLETADA',
  ));

  await sales.$disconnect();
  await inventory.$disconnect();
  console.log('PASS: persisted operation recovered after sales-service restart with one inventory movement.');
}

async function main() {
  const mode = process.argv[2] || 'core';
  try {
    await assertIsolatedDatabases();
    if (mode === 'core') {
      await testCore();
    } else if (mode === 'prepare-restart') {
      await prepareRestartCase();
    } else if (mode === 'finish-restart') {
      await finishRestartCase();
    } else {
      throw new Error('Unknown integration test mode.');
    }
  } catch (error) {
    console.error(`INTEGRATION HARNESS FAILED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([sales.$disconnect(), inventory.$disconnect()]);
  }
}

main();
