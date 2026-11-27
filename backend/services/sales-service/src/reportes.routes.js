const REPORT_TIME_ZONE = 'America/La_Paz';
const BOLIVIA_UTC_OFFSET = '-04:00';

function parseDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${fieldName} debe tener formato AAAA-MM-DD`);
    error.status = 400;
    throw error;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) {
    const error = new Error(`${fieldName} no es una fecha válida`);
    error.status = 400;
    throw error;
  }
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    const error = new Error(`${fieldName} no es una fecha válida`);
    error.status = 400;
    throw error;
  }

  return new Date(`${value}T00:00:00${BOLIVIA_UTC_OFFSET}`);
}

function parseDateRange(from, to, { required = true } = {}) {
  if (!from && !to && !required) return null;
  if (!from || !to) {
    const error = new Error('Debe especificar las fechas desde y hasta');
    error.status = 400;
    throw error;
  }

  const start = parseDate(from, 'desde');
  const end = parseDate(to, 'hasta');
  end.setUTCDate(end.getUTCDate() + 1);
  if (start >= end) {
    const error = new Error('El rango de fechas no es válido');
    error.status = 400;
    throw error;
  }

  return { start, end };
}

function parseStatus(value) {
  if (!value) return undefined;
  const status = String(value).toUpperCase();
  if (!['PENDIENTE', 'CONFIRMADA', 'ANULADA'].includes(status)) {
    const error = new Error('El estado de venta no es válido');
    error.status = 400;
    throw error;
  }
  return status;
}

function parseClientId(value) {
  if (value === undefined || value === '') return undefined;
  if (!/^[1-9]\d*$/.test(String(value))) {
    const error = new Error('cliente_id debe ser un identificador válido');
    error.status = 400;
    throw error;
  }
  return BigInt(value);
}

function parseClientName(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    const error = new Error('cliente debe ser un texto válido');
    error.status = 400;
    throw error;
  }
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > 100) {
    const error = new Error('cliente no puede superar los 100 caracteres');
    error.status = 400;
    throw error;
  }
  return name || undefined;
}

function parseSaleId(value) {
  if (value === undefined || value === '') return undefined;
  if (!/^[1-9]\d*$/.test(String(value))) {
    const error = new Error('venta_id debe ser un identificador válido');
    error.status = 400;
    throw error;
  }
  return BigInt(value);
}

function parseAmount(value, fieldName) {
  if (value === undefined || value === '') return undefined;
  if (
    typeof value !== 'string' ||
    !/^\d{1,10}(?:\.\d{1,2})?$/.test(value) ||
    !Number.isFinite(Number(value))
  ) {
    const error = new Error(`${fieldName} debe ser un importe válido con hasta dos decimales`);
    error.status = 400;
    throw error;
  }
  return Number(value);
}

function parsePaymentStatus(value) {
  if (!value) return undefined;
  const status = String(value).toUpperCase();
  if (!['PENDIENTE', 'PAGADO', 'ANULADO'].includes(status)) {
    const error = new Error('El estado del pago no es válido');
    error.status = 400;
    throw error;
  }
  return status;
}

function parsePaymentMethod(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    const error = new Error('El método de pago no es válido');
    error.status = 400;
    throw error;
  }
  const method = value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!method || method.length > 50) {
    const error = new Error('El método de pago debe contener entre 1 y 50 caracteres');
    error.status = 400;
    throw error;
  }
  return method;
}

function moneyCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function money(cents) {
  return Number((cents / 100).toFixed(2));
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeysInRange(range) {
  const keys = [];
  const date = new Date(range.start);
  while (date < range.end) {
    keys.push(dateKey(date));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return keys;
}

function normalizeSale(sale) {
  const pagosRecibidos = (sale.pagos || [])
    .filter((payment) => String(payment.estado).toUpperCase() === 'PAGADO')
    .reduce((sum, payment) => sum + moneyCents(payment.monto), 0);

  return {
    id: String(sale.id),
    fecha: sale.fecha_venta.toISOString(),
    responsable: null,
    importe: money(moneyCents(sale.total)),
    estado: sale.estado,
    pagosRecibidos: money(pagosRecibidos),
    metodosPago: [...new Set((sale.pagos || []).map((payment) => payment.metodo_pago).filter(Boolean))],
    cliente: sale.clientes
      ? [
          sale.clientes.nombre,
          sale.clientes.apellido_paterno,
          sale.clientes.apellido_materno,
        ].filter(Boolean).join(' ')
      : null,
  };
}

async function loadSales(prisma, range, filters = {}) {
  const where = {
    ...(range
      ? { fecha_venta: { gte: range.start, lt: range.end } }
      : {}),
    ...(filters.status ? { estado: filters.status } : {}),
    ...(filters.clientId ? { cliente_id: filters.clientId } : {}),
    ...(filters.clientName
      ? {
          clientes: {
            is: {
              AND: filters.clientName.split(' ').map((term) => ({
                OR: [
                  { nombre: { contains: term } },
                  { apellido_paterno: { contains: term } },
                  { apellido_materno: { contains: term } },
                ],
              })),
            },
          },
        }
      : {}),
    ...(filters.saleId ? { id: filters.saleId } : {}),
    ...(filters.minAmount !== undefined || filters.maxAmount !== undefined
      ? {
          total: {
            ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
            ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
          },
        }
      : {}),
    ...(filters.paymentStatus || filters.paymentMethod
      ? {
          pagos: {
            some: {
              ...(filters.paymentStatus ? { estado: filters.paymentStatus } : {}),
              ...(filters.paymentMethod ? { metodo_pago: filters.paymentMethod } : {}),
            },
          },
        }
      : {}),
  };

  return prisma.ventas.findMany({
    where,
    orderBy: [{ fecha_venta: 'asc' }, { id: 'asc' }],
    include: {
      clientes: {
        select: {
          nombre: true,
          apellido_paterno: true,
          apellido_materno: true,
        },
      },
      pagos: { select: { monto: true, estado: true, metodo_pago: true } },
    },
  });
}

async function loadReceivedPayments(prisma, range) {
  const payments = await prisma.pagos.findMany({
    where: {
      estado: 'PAGADO',
      fecha_pago: { gte: range.start, lt: range.end },
    },
    select: { monto: true, fecha_pago: true },
  });

  const byDay = new Map();
  const total = payments.reduce((sum, payment) => {
    const cents = moneyCents(payment.monto);
    const key = dateKey(payment.fecha_pago);
    byDay.set(key, (byDay.get(key) || 0) + cents);
    return sum + cents;
  }, 0);
  return { total, byDay };
}

function summarizeSales(sales) {
  const validSales = sales.filter(
    (sale) => String(sale.estado).toUpperCase() !== 'ANULADA',
  );
  return {
    ventasRegistradas: sales.length,
    cantidadVentas: validSales.length,
    ventasCanceladas: sales.length - validSales.length,
    ingresosPorVentas: money(
      validSales.reduce((sum, sale) => sum + moneyCents(sale.total), 0),
    ),
  };
}

function registerReportRoutes(app, prisma) {
  app.get('/reportes/diario', async (req, res) => {
    try {
      const selectedDate = parseDate(req.query.fecha, 'fecha');
      const from = dateKey(selectedDate);
      const nextDay = new Date(selectedDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const range = { start: selectedDate, end: nextDay };
      const sales = await loadSales(prisma, range);
      const paymentsReceived = await loadReceivedPayments(prisma, range);

      return res.json({
        tipo: 'diario',
        fecha: from,
        ...summarizeSales(sales),
        pagosRecibidos: money(paymentsReceived.total),
        operaciones: sales.map(normalizeSale),
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || 'No se pudo consultar el reporte diario',
      });
    }
  });

  app.get('/reportes/mensual', async (req, res) => {
    try {
      const year = Number(req.query.anio);
      const month = Number(req.query.mes);
      if (
        !Number.isInteger(year) ||
        year < 1000 ||
        year > 9999 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return res.status(400).json({ error: 'El mes y año no son válidos' });
      }

      const start = parseDate(
        `${year}-${String(month).padStart(2, '0')}-01`,
        'mes',
      );
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      const range = { start, end };
      const sales = await loadSales(prisma, range);
      const paymentsReceived = await loadReceivedPayments(prisma, range);
      const byDay = new Map();

      for (const sale of sales) {
        const key = dateKey(sale.fecha_venta);
        const day = byDay.get(key) || [];
        day.push(sale);
        byDay.set(key, day);
      }

      const resumenPorDia = dateKeysInRange(range).map((fecha) => ({
        fecha,
        ...summarizeSales(byDay.get(fecha) || []),
      }));

      return res.json({
        tipo: 'mensual',
        mes: month,
        anio: year,
        ...summarizeSales(sales),
        pagosRecibidos: money(paymentsReceived.total),
        resumenPorDia,
        operaciones: sales.map(normalizeSale),
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || 'No se pudo consultar el reporte mensual',
      });
    }
  });

  app.get('/reportes/ventas', async (req, res) => {
    try {
      const range = parseDateRange(req.query.desde, req.query.hasta);
      const minAmount = parseAmount(req.query.importe_min, 'importe_min');
      const maxAmount = parseAmount(req.query.importe_max, 'importe_max');
      if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
        const error = new Error('El importe mínimo no puede superar el importe máximo');
        error.status = 400;
        throw error;
      }
      const filters = {
        status: parseStatus(req.query.estado),
        clientId: parseClientId(req.query.cliente_id),
        clientName: parseClientName(req.query.cliente),
        saleId: parseSaleId(req.query.venta_id),
        minAmount,
        maxAmount,
        paymentStatus: parsePaymentStatus(req.query.estado_pago),
        paymentMethod: parsePaymentMethod(req.query.metodo_pago),
      };
      const sales = await loadSales(prisma, range, filters);

      return res.json({
        tipo: 'ventas',
        desde: req.query.desde,
        hasta: req.query.hasta,
        ...summarizeSales(sales),
        operaciones: sales.map(normalizeSale),
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || 'No se pudo consultar el reporte de ventas',
      });
    }
  });

  app.get('/reportes/ingresos', async (req, res) => {
    try {
      const range = parseDateRange(req.query.desde, req.query.hasta);
      const sales = await loadSales(prisma, range);
      const paymentsReceived = await loadReceivedPayments(prisma, range);
      const salesByDay = new Map();

      for (const sale of sales) {
        if (String(sale.estado).toUpperCase() === 'ANULADA') continue;
        const key = dateKey(sale.fecha_venta);
        salesByDay.set(
          key,
          (salesByDay.get(key) || 0) + moneyCents(sale.total),
        );
      }

      const dates = new Set([
        ...salesByDay.keys(),
        ...paymentsReceived.byDay.keys(),
      ]);
      return res.json({
        tipo: 'ingresos',
        desde: req.query.desde,
        hasta: req.query.hasta,
        ingresosPorVentas: summarizeSales(sales).ingresosPorVentas,
        pagosRecibidos: money(paymentsReceived.total),
        desglosePorDia: [...dates].sort().map((fecha) => ({
          fecha,
          ingresosPorVentas: money(salesByDay.get(fecha) || 0),
          pagosRecibidos: money(paymentsReceived.byDay.get(fecha) || 0),
        })),
        operaciones: sales.map(normalizeSale),
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || 'No se pudo consultar el reporte de ingresos',
      });
    }
  });
}

module.exports = {
  registerReportRoutes,
  parseDate,
  parseDateRange,
  summarizeSales,
};
