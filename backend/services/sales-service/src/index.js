require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const registrarRutasVentas = require('./ventas.routes');

const app = express();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-sales',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_sales',
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

function serializarBigInt(data) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

function normalizeClientText(value, fieldName, maxLength = 100) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} es obligatorio`);
  }

  const text = value.trim().replace(/\s+/g, ' ');

  if (!text) {
    throw new Error(`${fieldName} es obligatorio`);
  }

  if (text.length > maxLength) {
    throw new Error(
      `${fieldName} no puede superar los ${maxLength} caracteres`,
    );
  }

  if (!/^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(text)) {
    throw new Error(
      `${fieldName} solo puede contener letras, espacios, apóstrofes y guiones`,
    );
  }

  return text;
}

function normalizeClientPhone(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const phone = String(value).trim();

  if (!/^\d{8,9}$/.test(phone)) {
    throw new Error(
      'El teléfono debe contener entre 8 y 9 dí­gitos',
    );
  }

  return phone;
}

function normalizeClientEmail(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const email = String(value).trim().toLowerCase();

  if (email.length > 150) {
    throw new Error(
      'El correo no puede superar los 150 caracteres',
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo electrónico no tiene un formato válido');
  }

  return email;
}

function normalizeClientData(body) {
  return {
    nombre: normalizeClientText(body.nombre, 'El nombre'),
    apellido: normalizeClientText(body.apellido, 'El apellido'),
    telefono: normalizeClientPhone(body.telefono),
    correo: normalizeClientEmail(body.correo),
  };
}

app.get('/health', (req, res) => {
  res.json({
    service: 'sales-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'sales-service',
    message: 'Microservice ready',
  });
});


app.use(async (req, res, next) => {
  const method = req.method.toUpperCase();
  const path = req.path;
  let permission = null;

  // Seguimiento de una anulación persistente.
  if (
    ['GET', 'HEAD'].includes(method) &&
    /^\/ventas\/[^/]+\/anulacion\/?$/.test(path)
  ) {
    permission = 'VENTAS_LEER';
  }

  // Reintento de una anulación persistente.
  else if (
    method === 'POST' &&
    /^\/ventas\/[^/]+\/anulacion\/reintentar\/?$/.test(path)
  ) {
    permission = 'VENTAS_EDITAR';
  }
  // Consultas de ventas y pagos.
  else if (
    ['GET', 'HEAD'].includes(method) &&
    (
      /^\/ventas\/?$/.test(path) ||
      /^\/ventas\/[^/]+$/.test(path) ||
      /^\/pagos\/?$/.test(path)
    )
  ) {
    permission = 'VENTAS_LEER';
  }

  // Crear ventas.
  else if (
    method === 'POST' &&
    /^\/ventas\/?$/.test(path)
  ) {
    permission = 'VENTAS_CREAR';
  }

  // Cambiar el estado de una venta.
  else if (
    method === 'PATCH' &&
    /^\/ventas\/[^/]+\/estado\/?$/.test(path)
  ) {
    permission = 'VENTAS_EDITAR';
  }

  // Consultar clientes.
  else if (
    ['GET', 'HEAD'].includes(method) &&
    (
      /^\/clientes\/?$/.test(path) ||
      /^\/clientes\/[^/]+$/.test(path)
    )
  ) {
    permission = 'CLIENTES_LEER';
  }

  // Crear clientes.
  else if (
    method === 'POST' &&
    /^\/clientes\/?$/.test(path)
  ) {
    permission = 'CLIENTES_CREAR';
  }

  // Editar datos de un cliente.
  else if (
    method === 'PUT' &&
    /^\/clientes\/[^/]+$/.test(path)
  ) {
    permission = 'CLIENTES_EDITAR';
  }

  // Cambiar el estado de un cliente.
  else if (
    method === 'PATCH' &&
    /^\/clientes\/[^/]+\/estado\/?$/.test(path)
  ) {
    permission = 'CLIENTES_CAMBIAR_ESTADO';
  }

  // Registrar pagos.
  else if (
    method === 'POST' &&
    /^\/pagos\/?$/.test(path)
  ) {
    permission = 'VENTAS_CREAR';
  }

  // No interceptar rutas ajenas a ventas, clientes y pagos.
  if (!permission) {
    const esRutaComercial = /^\/(ventas|clientes|pagos)(?:\/|$)/.test(path);

    if (!esRutaComercial) {
      return next();
    }

    // Dentro de las rutas comerciales, los métodos u operaciones
    // no contemplados deben permanecer bloqueados.
    return res.status(403).json({
      error: 'Operación no autorizada para este servicio',
    });
  }

  const authorization = req.get('authorization');

  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({
      error: 'Se requiere un token Bearer válido',
    });
  }

  const usersServiceUrl = process.env.USERS_SERVICE_URL;
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!usersServiceUrl || !internalSecret) {
    console.error('Falta la configuración de autenticación');

    return res.status(503).json({
      error: 'El servicio de autenticación no está disponible',
    });
  }

  try {
    const response = await fetch(
      `${usersServiceUrl.replace(/\/+$/, '')}/internal/auth/validate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
          'x-internal-service-key': internalSecret,
        },
        body: JSON.stringify({ permission }),
        signal: AbortSignal.timeout(5000),
      },
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.valid !== true) {
      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: result.error || 'No tienes permiso para esta operación',
        });
      }

      return res.status(503).json({
        error: 'No se pudo validar la autorización',
      });
    }

    req.authenticatedUser = result.user;
    req.requiredPermission = permission;

    return next();
  } catch (error) {
    console.error('Error al validar autorización:', error);

    return res.status(503).json({
      error: 'El servicio de autenticación no está disponible',
    });
  }
});

app.get('/ventas', async (req, res) => {
  try {
    const ventas = await prisma.ventas.findMany({
      include: {
        clientes: true,
        detalle_ventas: true,
        pagos: true,
      },
    });

    res.json(ventas);
  } catch (error) {
    console.error('Error al consultar ventas:', error);

    res.status(500).json({
      error: 'No se pudieron consultar las ventas',
    });
  }
});

app.get('/clientes', async (req, res) => {
  try {
    const { buscar } = req.query;

    const clientes = await prisma.clientes.findMany({
      where: buscar
        ? {
            OR: [
              {
                nombre: {
                  contains: String(buscar),
                },
              },
              {
                apellido: {
                  contains: String(buscar),
                },
              },
              {
                telefono: {
                  contains: String(buscar),
                },
              },
              {
                correo: {
                  contains: String(buscar),
                },
              },
            ],
          }
        : undefined,
      orderBy: {
        id: 'desc',
      },
    });

    res.json(serializarBigInt(clientes));
  } catch (error) {
    console.error('Error al consultar clientes:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los clientes',
    });
  }
});

app.get('/clientes/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const cliente = await prisma.clientes.findUnique({
      where: { id },
    });

    if (!cliente) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    return res.json(cliente);
  } catch (error) {
    console.error('Error al consultar cliente:', error);

    return res.status(500).json({
      error: 'No se pudo consultar el cliente',
    });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const { nombre, apellido, telefono, correo } = normalizeClientData(req.body);

    const cliente = await prisma.clientes.create({
      data: {
        nombre,
        apellido,
        telefono,
        correo,
      },
    });

    return res.status(201).json(cliente);
  } catch (error) {
    console.error('Error al crear cliente:', error);

    return res.status(400).json({
      error: error.message,
    });
  }
});

app.put('/clientes/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const clienteActual = await prisma.clientes.findUnique({
      where: { id },
    });

    if (!clienteActual) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    const { nombre, apellido, telefono, correo } = normalizeClientData(req.body);

    if (correo) {
      const existente = await prisma.clientes.findFirst({
        where: {
          correo,
          NOT: {
            id,
          },
        },
      });

      if (existente) {
        return res.status(409).json({
          error: 'Ya existe otro cliente con ese correo',
        });
      }
    }

    const cliente = await prisma.clientes.update({
      where: { id },
      data: {
        nombre,
        apellido,
        telefono,
        correo,
      },
    });

    return res.json(serializarBigInt(cliente));
  } catch (error) {
    console.error('Error al actualizar cliente:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo actualizar el cliente',
    });
  }
});
app.patch('/clientes/:id/estado', async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { estado } = req.body;

    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({
        error: 'Estado inválido',
      });
    }

    const clienteActual = await prisma.clientes.findUnique({
      where: { id },
    });

    if (!clienteActual) {
      return res.status(404).json({
        error: 'Cliente no encontrado',
      });
    }

    const cliente = await prisma.clientes.update({
      where: { id },
      data: {
        estado,
      },
    });

    return res.json(cliente);
  } catch (error) {
    console.error('Error al cambiar estado del cliente:', error);

    return res.status(500).json({
      error: 'No se pudo cambiar el estado del cliente',
    });
  }
});

app.get('/pagos', async (req, res) => {
  try {
    const pagos = await prisma.pagos.findMany({
      include: {
        ventas: true,
      },
    });

    res.json(pagos);
  } catch (error) {
    console.error('Error al consultar pagos:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los pagos',
    });
  }
});

registrarRutasVentas(app, prisma);

app.listen(port, () => {
  console.log(`sales-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
