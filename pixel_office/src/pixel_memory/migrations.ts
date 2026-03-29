import { getPool, getConfig } from "./config.js";
import { schemas, SCHEMA_VERSION } from "./schema.js";
import type { DbType } from "./config.js";

const MIGRATION_TABLE = "schema_migrations";

async function runDbQuery(pool: any, sql: string, params?: any[]): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows || result;
}

async function ensureMigrationTable(pool: any, dbType: DbType): Promise<void> {
  if (dbType === "postgres") {
    await runDbQuery(pool, `
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        version INT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } else {
    await runDbQuery(pool, `
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        version INT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
  }
}

async function getAppliedMigrations(pool: any): Promise<number[]> {
  const rows = await runDbQuery(pool, `SELECT version FROM ${MIGRATION_TABLE} ORDER BY version`);
  return rows.map((row: any) => row.version);
}

async function markMigrationApplied(pool: any, dbType: DbType, version: number): Promise<void> {
  if (dbType === "postgres") {
    await runDbQuery(pool, `INSERT INTO ${MIGRATION_TABLE} (version) VALUES ($1)`, [version]);
  } else {
    await runDbQuery(pool, `INSERT INTO ${MIGRATION_TABLE} (version) VALUES (?)`, [version]);
  }
}

export async function runMigrations(): Promise<void> {
  const pool = await getPool();
  const config = getConfig();
  const dbType = config.db.type;
  const dbSchemas = schemas[dbType];

  await ensureMigrationTable(pool, dbType);
  const applied = await getAppliedMigrations(pool);

  console.log(`Current database: ${config.db.database}`);
  console.log(`Applied migrations: ${applied.join(", ") || "none"}`);

  if (applied.includes(SCHEMA_VERSION)) {
    console.log(`Schema v${SCHEMA_VERSION} already applied.`);
    await ensureDefaultUser(pool, dbType);
    return;
  }

  console.log(`Applying schema v${SCHEMA_VERSION}...`);

  if (SCHEMA_VERSION > 4) {
    console.log("  Checking completed_at column in daily_plan_items...");
    try {
      if (dbType === "postgres") {
        await runDbQuery(pool, `ALTER TABLE daily_plan_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`);
      } else {
        await runDbQuery(pool, `ALTER TABLE daily_plan_items ADD COLUMN completed_at TIMESTAMP NULL`);
      }
    } catch (err: any) {
      if (err.code !== "4271" && err.code !== "ER_DUP_FIELDNAME") {
        throw err;
      }
      console.log("  completed_at column already exists, skipping...");
    }
  }

  for (const tableName of Object.keys(dbSchemas) as (keyof typeof dbSchemas)[]) {
    const sql = dbSchemas[tableName];
    console.log(`  Creating ${tableName}...`);
    await runDbQuery(pool, sql);
  }

  await markMigrationApplied(pool, dbType, SCHEMA_VERSION);
  console.log(`Schema v${SCHEMA_VERSION} applied successfully!`);

  await ensureDefaultUser(pool, dbType);
}

async function ensureDefaultUser(pool: any, dbType: DbType): Promise<void> {
  try {
    const existing = await runDbQuery(pool, "SELECT id FROM users WHERE id = 1");
    if (existing.length === 0) {
      console.log("  Creating default user...");
      if (dbType === "postgres") {
        await runDbQuery(pool, "INSERT INTO users (id, email, name) VALUES (1, 'default@pixel.office', 'Default User')");
      } else {
        await runDbQuery(pool, "INSERT INTO users (id, email, name) VALUES (1, 'default@pixel.office', 'Default User')");
      }
      console.log("  Default user created.");
    }
  } catch (err) {
    console.log("  Default user check skipped:", err);
  }
}

export async function migrate(): Promise<void> {
  try {
    await runMigrations();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}
