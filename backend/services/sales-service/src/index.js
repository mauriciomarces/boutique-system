require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-sales',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_sales',
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

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
    const clientes = await prisma.clientes.findMany({
      include: {
        ventas: true,
      },
    });

    res.json(clientes);
  } catch (error) {
    console.error('Error al consultar clientes:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los clientes',
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