const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const adapter = new PrismaMariaDb({
  host: "mysql-inventory",
  port: 3306,
  user: "boutique",
  password: "secret",
  database: "boutique_inventory"
});

const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const result = await prisma.existencias.findMany();
    console.log("RESULTADO:", result);
  } catch (error) {
    console.error("ERROR:", error);
  }
}

main();
