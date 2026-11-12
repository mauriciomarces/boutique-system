const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  registerReportRoutes,
  parseDateRange,
} = require('../src/reportes.routes');

function createRouteHarness({ sales, payments }) {
  const handlers = new Map();
  const calls = [];
  const app = {
    get(path, handler) {
      handlers.set(path, handler);
    },
  };
  const prisma = {
    ventas: {
      findMany: async (args) => {
        calls.push({ model: 'ventas', args });
        return sales;
      },
    },
    pagos: {
      findMany: async (args) => {
        calls.push({ model: 'pagos', args });
        return payments;
      },
    },
  };
  registerReportRoutes(app, prisma);
  return { handlers, calls };
}

function invoke(handler, query) {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  return Promise.resolve(handler({ query }, response)).then(() => response);
}

const sales = [
  {
    id: 1n,
    fecha_venta: new Date(2026, 9, 3, 10),
    estado: 'CONFIRMADA',
    total: '120.50',
    clientes: { nombre: 'Ana', apellido: 'Lopez' },
    pagos: [{ monto: '50.25', estado: 'PAGADO' }],
  },
  {
    id: 2n,
    fecha_venta: new Date(2026, 9, 3, 11),
    estado: 'ANULADA',
    total: '40.00',
    clientes: null,
    pagos: [],
  },
  {
    id: 3n,
    fecha_venta: new Date(2026, 9, 4, 9),
    estado: 'PENDIENTE',
    total: '30.25',
    clientes: null,
    pagos: [{ monto: '30.25', estado: 'PENDIENTE' }],
  },
];

test('el reporte diario separa ventas anuladas, ingresos y pagos recibidos', async () => {
  const { handlers, calls } = createRouteHarness({
    sales: sales.slice(0, 2),
    payments: [{ monto: '20.00', fecha_pago: new Date(2026, 9, 3, 10) }],
  });

  const response = await invoke(handlers.get('/reportes/diario'), {
    fecha: '2026-10-03',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ventasRegistradas, 2);
  assert.equal(response.payload.cantidadVentas, 1);
  assert.equal(response.payload.ventasCanceladas, 1);
  assert.equal(response.payload.ingresosPorVentas, 120.5);
  assert.equal(response.payload.pagosRecibidos, 20);
  assert.equal(response.payload.operaciones[0].cliente, 'Ana Lopez');
  assert.equal(
    calls.find(({ model }) => model === 'ventas').args.where.fecha_venta.gte.getDate(),
    3,
  );
  assert.equal(
    calls.find(({ model }) => model === 'ventas').args.where.fecha_venta.lt.getDate(),
    4,
  );
});

test('el reporte mensual agrega ventas por día e ingresos sin incluir anulaciones', async () => {
  const { handlers } = createRouteHarness({
    sales,
    payments: [{ monto: '50.25', fecha_pago: new Date(2026, 9, 3, 10) }],
  });

  const response = await invoke(handlers.get('/reportes/mensual'), {
    mes: '10',
    anio: '2026',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.cantidadVentas, 2);
  assert.equal(response.payload.ventasCanceladas, 1);
  assert.equal(response.payload.ingresosPorVentas, 150.75);
  assert.equal(response.payload.resumenPorDia.length, 31);
  assert.equal(response.payload.resumenPorDia[0].fecha, '2026-10-01');
  assert.equal(response.payload.resumenPorDia[2].fecha, '2026-10-03');
  assert.equal(response.payload.resumenPorDia[30].fecha, '2026-10-31');
  assert.equal(response.payload.resumenPorDia[0].cantidadVentas, 0);
});

test('los filtros de fechas rechazan rangos inválidos y fechas imposibles', () => {
  assert.throws(
    () => parseDateRange('2026-10-04', '2026-10-03'),
    /rango de fechas/,
  );
  assert.throws(
    () => parseDateRange('2026-02-30', '2026-03-01'),
    /no es una fecha válida/,
  );
});

test('el reporte de ingresos expone ventas y pagos como métricas distintas', async () => {
  const { handlers } = createRouteHarness({
    sales: sales.slice(0, 2),
    payments: [{ monto: '50.25', fecha_pago: new Date(2026, 9, 3, 10) }],
  });

  const response = await invoke(handlers.get('/reportes/ingresos'), {
    desde: '2026-10-03',
    hasta: '2026-10-03',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ingresosPorVentas, 120.5);
  assert.equal(response.payload.pagosRecibidos, 50.25);
  assert.deepEqual(response.payload.desglosePorDia, [
    {
      fecha: '2026-10-03',
      ingresosPorVentas: 120.5,
      pagosRecibidos: 50.25,
    },
  ]);
});

test('el reporte de ventas aplica rango de fechas, estado y cliente', async () => {
  const { handlers, calls } = createRouteHarness({
    sales: [],
    payments: [],
  });
  const response = await invoke(handlers.get('/reportes/ventas'), {
    desde: '2026-10-01',
    hasta: '2026-10-31',
    estado: 'anulada',
    cliente_id: '17',
  });

  assert.equal(response.statusCode, 200);
  const query = calls[0].args.where;
  assert.equal(query.estado, 'ANULADA');
  assert.equal(query.cliente_id, 17n);
  assert.equal(query.fecha_venta.gte.getDate(), 1);
  assert.equal(query.fecha_venta.lt.getDate(), 1);
  assert.equal(query.fecha_venta.lt.getMonth(), 10);
});

test('los endpoints de reportes responden 400 ante filtros inválidos', async () => {
  const { handlers } = createRouteHarness({ sales: [], payments: [] });
  const response = await invoke(handlers.get('/reportes/ventas'), {
    desde: '2026-10-01',
    hasta: '2026-10-31',
    estado: 'BORRADOR',
  });
  assert.equal(response.statusCode, 400);
});
