import "dotenv/config";
import { Pool } from "pg";
import * as mysql from "mysql2/promise";

export type DbType = "postgres" | "mysql";

export interface DbConfig {
  type: DbType;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface PixelMemoryConfig {
  db: DbConfig;
}

function getConfig(): PixelMemoryConfig {
  const dbType = (process.env.CORE_DB_TYPE as DbType) || "postgres";
  const dbPort = parseInt(process.env.CORE_DB_PORT || "", 10) || (dbType === "mysql" ? 3306 : 5432);

  return {
    db: {
      type: dbType,
      host: process.env.CORE_DB_HOST || "localhost",
      port: dbPort,
      database: process.env.CORE_DB_NAME || "hermit_core",
      user: process.env.CORE_DB_USER || "pixel_app",
      password: process.env.CORE_DB_PASS || "",
    },
  };
}

let pool: Pool | mysql.Pool | null = null;

export async function getPool(): Promise<Pool | mysql.Pool> {
  if (pool) return pool;

  const config = getConfig();

  if (config.db.type === "postgres") {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    });
  } else {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    if (pool instanceof Pool) {
      await pool.end();
    } else {
      await (pool as mysql.Pool).end();
    }
    pool = null;
  }
}

export { getConfig };
