import mysql from "mysql2/promise";
import "dotenv/config";

async function smokeTest() {
  console.log("Testing database connection...\n");

  const config = {
    host: process.env.CORE_DB_HOST,
    port: parseInt(process.env.CORE_DB_PORT || "3306", 10),
    user: process.env.CORE_DB_USER,
    password: process.env.CORE_DB_PASS,
    database: process.env.CORE_DB_NAME,
  };

  console.log("Config:");
  console.log(`  Host: ${config.host}:${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}`);
  console.log();

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log("✓ Connection successful!\n");

    const [status] = await connection.query("SELECT @@version as version");
    console.log("Server version:", (status as any)[0].version);

    const [dbInfo] = await connection.query("SHOW DATABASES LIKE ?", [config.database]);
    console.log("Database exists:", (dbInfo as any).length > 0 ? "Yes" : "No");

    const [tables] = await connection.query("SHOW TABLES");
    console.log(`\nTables in ${config.database}:`, (tables as any).length);
    for (const t of tables as any) {
      const tableName = Object.values(t)[0];
      const [count] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
      console.log(`  - ${tableName}: ${(count as any)[0].cnt} rows`);
    }

    await connection.end();
    console.log("\n✓ Smoke test passed!");
  } catch (err: any) {
    console.error("✗ Connection failed:", err.message);
    process.exit(1);
  }
}

smokeTest();
