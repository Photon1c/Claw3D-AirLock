import { getPool } from "../src/pixel_memory/config.js";

async function main() {
  const pool = await getPool();
  try {
    const [rows]: any = await pool.query("SELECT * FROM users");
    console.log("Users:", JSON.stringify(rows, null, 2));
    
    if (!rows || rows.length === 0) {
      console.log("Inserting default user...");
      await pool.query("INSERT INTO users (id, email, name) VALUES (1, 'default@pixel.office', 'Default User')");
      console.log("Default user created!");
    }
  } finally {
    await pool.end();
  }
}

main();
