import "dotenv/config";
import { getPool, getConfig } from "../src/pixel_memory/config.js";

const DEBUG = true;

async function runDebug() {
  console.log("=== Chat API Debug Script ===\n");

  const testMessage = "show me the tables in the database";
  
  console.log("Test message:", testMessage);
  console.log();

  const pool = await getPool();
  const config = getConfig();
  
  console.log("DB Config:");
  console.log("  Host:", config.db.host);
  console.log("  Port:", config.db.port);
  console.log("  Database:", config.db.database);
  console.log("  User:", config.db.user);
  console.log("  Type:", config.db.type);
  console.log();

  // Get database schema
  async function getDbSchema() {
    const isPg = config.db.type === "postgres";
    let tables: string[] = [];
    
    try {
      if (isPg) {
        const result = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        tables = result.rows.map((r: any) => r.table_name);
      } else {
        const [rows] = await pool.query("SHOW TABLES");
        tables = rows.map((r: any) => Object.values(r)[0] as string);
      }
    } catch (err: any) {
      console.error("Error getting tables:", err.message);
    }
    
    return tables.join(", ");
  }

  const dbSchema = await getDbSchema();
  console.log("Database schema:", dbSchema);
  console.log();

  // Simulate the chat API call
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OpenAI API Key configured:", !!apiKey);
  if (apiKey) {
    console.log("  Key starts with:", apiKey.substring(0, 10) + "...");
  }
  console.log();

  // Test actual API call
  try {
    const response = await fetch("http://localhost:4173/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: testMessage,
        history: [],
      }),
    });
    
    console.log("Response status:", response.status);
    console.log("Response statusText:", response.statusText);
    
    const contentType = response.headers.get("content-type");
    console.log("Content-Type:", contentType);
    
    const data = await response.json();
    console.log("\nResponse data:");
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (err: any) {
    console.error("Request error:", err.message);
    throw err;
  }
}

runDebug().catch(console.error);
