require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-inventory',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_inventory',
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'inventory-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'inventory-service',
    message: 'Microservice ready',
  });
});

app.get('/existencias', async (req, res) => {
  try {
    const existencias = await prisma.existencias.findMany();

    res.json(existencias);
  } catch (error) {
    console.error('Error al consultar existencias:', error);

    res.status(500).json({
      error: 'No se pudieron consultar las existencias',
    });
  }
});

app.get('/proveedores', async (req, res) => {
  try {
    const proveedores = await prisma.proveedores.findMany({
      include: {
        compras: true,
      },
    });

    res.json(proveedores);
  } catch (error) {
    console.error('Error al consultar proveedores:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los proveedores',
    });
  }
});

app.listen(port, () => {
  console.log(`inventory-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});