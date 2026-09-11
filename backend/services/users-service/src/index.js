require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-users',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_users',
  connectionLimit: 5,
  acquireTimeout: 30000,
  connectTimeout: 30000,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'users-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'users-service',
    message: 'Microservice ready',
  });
});

app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuarios.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        estado: true,
        creado_en: true,
        actualizado_en: true,
      },
    });

    res.json(usuarios);
  } catch (error) {
    console.error('Error al consultar usuarios:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los usuarios',
    });
  }
});

app.listen(port, () => {
  console.log(`users-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});