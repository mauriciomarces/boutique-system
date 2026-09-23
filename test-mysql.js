const mariadb = require('mariadb');

async function main() {
  const pool = mariadb.createPool({
    host: 'mysql-notifications',
    port: 3306,
    user: 'boutique',
    password: 'secret',
    database: 'boutique_notifications',
    connectionLimit: 2,
    connectTimeout: 5000,
    acquireTimeout: 5000,
    ssl: false,
  });

  try {
    console.log('Intentando conectar...');

    const connection = await pool.getConnection();

    console.log('CONEXION MYSQL OK');

    const result = await connection.query('SELECT 1 AS resultado');

    console.log(result[0]);

    connection.release();
  } catch (error) {
    console.error('ERROR COMPLETO:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
