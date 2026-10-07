require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

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
      `${fieldName} solo puede contener letras, espacios, apÃ³strofes y guiones`,
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
      'El telÃ©fono debe contener entre 8 y 9 dÃ­gitos',
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
    throw new Error('El correo electrÃ³nico no tiene un formato vÃ¡lido');
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
        error: 'Estado invÃ¡lido',
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


