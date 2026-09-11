const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const adapter = new PrismaMariaDb({
  host: "mysql-notifications",
  port: 3306,
  user: "boutique",
  password: "secret",
  database: "boutique_notifications"
});

const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const result = await prisma.notificaciones.findMany();
    console.log("RESULTADO:", result);
  } catch (error) {
    console.error("ERROR:", error);
  }
}

main();
