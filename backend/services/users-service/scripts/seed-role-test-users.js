require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const rolesToPrepare = [
  {
    role: 'ADMIN',
    env: 'ROLE_TEST_ADMIN',
    name: 'Daniela',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Fernández',
  },
  {
    role: 'SUPERVISOR',
    env: 'ROLE_TEST_SUPERVISOR',
    name: 'Gabriel',
    apellidoPaterno: 'Vargas',
    apellidoMaterno: 'Méndez',
  },
  {
    role: 'VENDEDOR',
    env: 'ROLE_TEST_VENDEDOR',
    name: 'Natalia',
    apellidoPaterno: 'Flores',
    apellidoMaterno: 'Quiroga',
  },
  {
    role: 'INVENTARIO',
    env: 'ROLE_TEST_INVENTARIO',
    name: 'Luis',
    apellidoPaterno: 'Paredes',
    apellidoMaterno: 'Ríos',
  },
  {
    role: 'CONSULTA',
    env: 'ROLE_TEST_CONSULTA',
    name: 'Andrea',
    apellidoPaterno: 'Morales',
    apellidoMaterno: 'Castillo',
  },
];

function accountEmail(definition) {
  const configured = process.env[`${definition.env}_EMAIL`];
  const email = (configured || `cuenta.${definition.role.toLowerCase()}@sposabella.invalid`)
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@sposabella\.invalid$/.test(email)) {
    throw new Error(
      `${definition.env}_EMAIL debe usar el dominio no enrutable sposabella.invalid.`,
    );
  }
  return email;
}

function passwordFor(definition) {
  return process.env[`${definition.env}_PASSWORD`];
}

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 20 &&
    new Set(password).size >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}

function buildPrisma() {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Falta configurar conexión de base de datos: ${missing.join(', ')}`);
  }

  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 30000),
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

async function prepareRoleTestUsers(prisma) {
  const roleRecords = await prisma.roles.findMany({
    where: { nombre: { in: rolesToPrepare.map(({ role }) => role) } },
    select: { id: true, nombre: true, estado: true },
  });
  const byName = new Map(
    roleRecords.map((record) => [record.nombre.toUpperCase(), record]),
  );
  const accounts = rolesToPrepare.map((definition) => {
    const role = byName.get(definition.role);
    if (!role) throw new Error(`No existe el rol requerido ${definition.role}.`);
    if (String(role.estado).toUpperCase() !== 'ACTIVO') {
      throw new Error(`El rol ${definition.role} no está activo.`);
    }

    return {
      ...definition,
      roleId: role.id,
      email: accountEmail(definition),
    };
  });

  if (new Set(accounts.map(({ email }) => email)).size !== accounts.length) {
    throw new Error('Los correos de prueba deben ser distintos.');
  }

  const existingAccounts = await Promise.all(
    accounts.map(({ email }) =>
      prisma.usuarios.findUnique({
        where: { correo: email },
        select: {
          id: true,
          estado: true,
          correo_verificado: true,
          credenciales: { select: { estado: true } },
          usuario_rol: {
            select: { roles: { select: { nombre: true } } },
          },
        },
      }),
    ),
  );

  accounts.forEach((account, index) => {
    const existing = existingAccounts[index];
    if (!existing) return;

    const linkedRoles = existing.usuario_rol.map(({ roles }) =>
      roles.nombre.toUpperCase(),
    );
    if (
      linkedRoles.length !== 1 ||
      linkedRoles[0] !== account.role ||
      String(existing.estado).toUpperCase() !== 'ACTIVO' ||
      !existing.correo_verificado ||
      String(existing.credenciales?.estado).toUpperCase() !== 'ACTIVO'
    ) {
      throw new Error(
        `La cuenta existente ${account.email} no coincide con el rol/estado esperado; no fue modificada.`,
      );
    }
  });

  const missingAccounts = accounts.filter(
    (_, index) => !existingAccounts[index],
  );
  const passwordHashes = await Promise.all(
    missingAccounts.map(async (account) => {
      const password = passwordFor(account);
      if (!isStrongPassword(password)) {
        throw new Error(
          `Define ${account.env}_PASSWORD con una contraseña aleatoria fuerte de al menos 20 caracteres.`,
        );
      }
      return bcrypt.hash(password, 12);
    }),
  );

  const hashByEmail = new Map(
    missingAccounts.map((account, index) => [
      account.email,
      passwordHashes[index],
    ]),
  );

  await prisma.$transaction(async (transaction) => {
    for (const account of missingAccounts) {
      const now = new Date();
      await transaction.usuarios.create({
        data: {
          nombre: account.name,
          apellido_paterno: account.apellidoPaterno,
          apellido_materno: account.apellidoMaterno,
          apellido: `${account.apellidoPaterno} ${account.apellidoMaterno}`,
          correo: account.email,
          estado: 'ACTIVO',
          creado_en: now,
          actualizado_en: now,
          correo_verificado: true,
          verificado_en: now,
          credenciales: {
            create: {
              hash_contrasena: hashByEmail.get(account.email),
              estado: 'ACTIVO',
              creado_en: now,
              actualizado_en: now,
            },
          },
          usuario_rol: {
            create: {
              roles: { connect: { id: account.roleId } },
            },
          },
        },
      });
    }
  });

  return accounts.map(({ email, role }, index) => ({
    correo: email,
    rol: role,
    estado: existingAccounts[index] ? 'verificado' : 'creado',
  }));
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Las cuentas de prueba no se pueden preparar en producción.');
  }
  const prisma = buildPrisma();
  try {
    const accounts = await prepareRoleTestUsers(prisma);
    for (const account of accounts) {
      console.log(`${account.estado}: ${account.correo} (${account.rol})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error?.code
    ? `fallo de base de datos (${error.code})`
    : error instanceof Error
      ? error.message
      : 'Error no identificado';
  console.error(`No se pudieron preparar las cuentas de prueba: ${message}`);
  process.exitCode = 1;
});
