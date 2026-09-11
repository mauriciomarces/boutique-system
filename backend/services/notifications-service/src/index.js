require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-notifications',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_notifications',
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'notifications-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'notifications-service',
    message: 'Microservice ready',
  });
});

app.get('/notificaciones', async (req, res) => {
  try {
    const notificaciones = await prisma.notificaciones.findMany();

    res.json(notificaciones);
  } catch (error) {
    console.error('Error al consultar notificaciones:', error);

    res.status(500).json({
      error: 'No se pudieron consultar las notificaciones',
    });
  }
});

app.listen(port, () => {
  console.log(`notifications-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});