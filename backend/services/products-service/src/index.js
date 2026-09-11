require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-products',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_products',
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'products-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'products-service',
    message: 'Microservice ready',
  });
});

app.get('/productos', async (req, res) => {
  try {
    const productos = await prisma.productos.findMany({
      include: {
        categorias: true,
        variantes: true,
      },
    });

    res.json(productos);
  } catch (error) {
    console.error('Error al consultar productos:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los productos',
    });
  }
});

app.listen(port, () => {
  console.log(`products-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});