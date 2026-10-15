const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mariadb = require('mariadb');

const expectedDatabase = 'boutique_sales';
const expectedHost = 'mysql-sales';
const schemaPath = '/app/backend/services/sales-service/prisma/schema.prisma';
const sqlPath =
  '/app/backend/services/sales-service/prisma/anulacion_persistente.sql';
const packagePath = '/app/backend/services/sales-service';
const tableNames = [
  'operaciones_anulacion',
  'tareas_anulacion',
  'eventos_anulacion',
];
const temporaryClient = path.join(
  os.tmpdir(),
  `sales-bootstrap-client-${process.pid}`,
);

function configFromDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, '');
  if (url.hostname !== expectedHost || database !== expectedDatabase) {
    throw new Error('DATABASE_URL no apunta a la DB aislada de ventas esperada.');
  }
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    multipleStatements: false,
  };
}

async function countTables(connection, names) {
  const rows = await connection.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN (${names.map(() => '?').join(',')})`,
    names,
  );
  return Number(rows[0].total);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL de la instancia aislada.');
  }

  const connection = await mariadb.createConnection(
    configFromDatabaseUrl(process.env.DATABASE_URL),
  );
  let temporarySchema;

  try {
    const identity = await connection.query(
      `SELECT DATABASE() AS database_name, @@hostname AS hostname,
        VERSION() AS version, @@global.read_only AS read_only`,
    );
    const database = identity[0];
    if (
      database.database_name !== expectedDatabase ||
      !/^[a-f0-9]{12}$/.test(database.hostname) ||
      !String(database.version).startsWith('8.4.') ||
      Number(database.read_only) !== 0
    ) {
      throw new Error('La identidad de la DB no cumple las guardas de prueba.');
    }
    console.log(
      `Verified isolated sales DB ${database.database_name} on container ${database.hostname}.`,
    );

    const existingCount = await countTables(connection, tableNames);
    if (existingCount === 0) {
      const parentCount = await countTables(connection, [
        'ventas',
        'detalle_ventas',
      ]);
      if (parentCount !== 0 && parentCount !== 2) {
        throw new Error('El esquema base de ventas está incompleto.');
      }

      if (parentCount === 0) {
        const fullSchema = fs.readFileSync(schemaPath, 'utf8');
        const modelOffset = fullSchema.indexOf('\nmodel operaciones_anulacion {');
        if (modelOffset < 0) {
          throw new Error('No se encontró el bloque de modelos de anulación.');
        }
        const baseSchema = fullSchema
          .slice(0, modelOffset)
          .split(/\r?\n/)
          .filter((line) =>
            !/\b(?:operaciones_anulacion|tareas_anulacion)\b/.test(line),
          )
          .join('\n')
          .replace(
            /generator client \{\s*provider = "prisma-client-js"\s*\}/,
            `generator client {\n  provider = "prisma-client-js"\n  output = "${temporaryClient}"\n}`,
          );
        temporarySchema = path.join(
          os.tmpdir(),
          `sales-base-${process.pid}.prisma`,
        );
        fs.writeFileSync(temporarySchema, baseSchema);
        execFileSync(
          'pnpm',
          [
            'exec',
            'prisma',
            'db',
            'push',
            '--schema',
            temporarySchema,
          ],
          { cwd: packagePath, stdio: 'inherit' },
        );
      }

      if (
        await countTables(connection, ['ventas', 'detalle_ventas']) !== 2 ||
        await countTables(connection, tableNames) !== 0
      ) {
        throw new Error('Precondiciones SQL de ventas no satisfechas.');
      }

      const sql = fs.readFileSync(sqlPath, 'utf8');
      if (/ON\s+UPDATE\s+CURRENT_TIMESTAMP/i.test(sql)) {
        throw new Error('DDL incompatible: Prisma administra @updatedAt.');
      }
      const statements = sql
        .replace(/^\s*--.*$/gm, '')
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);
      if (
        statements.length !== tableNames.length ||
        statements.some((statement) => !/^CREATE\s+TABLE\b/i.test(statement))
      ) {
        throw new Error('El SQL no tiene la forma esperada para el bootstrap.');
      }

      for (const statement of statements) {
        await connection.query(statement);
      }
      console.log('Applied cancellation DDL to the verified isolated sales DB.');
    } else if (existingCount !== tableNames.length) {
      throw new Error(
        'Hay tablas de anulación parciales; inspeccionar antes de corregir.',
      );
    } else {
      console.log('Cancellation DDL already exists; no SQL was reapplied.');
    }

    if (await countTables(connection, tableNames) !== tableNames.length) {
      throw new Error('Faltan tablas de anulación después del bootstrap.');
    }
  } finally {
    if (temporarySchema && fs.existsSync(temporarySchema)) {
      fs.unlinkSync(temporarySchema);
    }
    if (fs.existsSync(temporaryClient)) {
      fs.rmSync(temporaryClient, { recursive: true, force: true });
    }
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Integration schema bootstrap failed: ${error.message}`);
  process.exitCode = 1;
});
