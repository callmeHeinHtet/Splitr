// Quick connection test for Neon via node-postgres
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const cleaned = connectionString.replace(/[?&]channel_binding=[^&]*/g, "");

console.log("Connecting to:", cleaned.replace(/:[^@]+@/, ":***@"));

const pool = new Pool({
  connectionString: cleaned,
  ssl: true,
  connectionTimeoutMillis: 15000,
});

const start = Date.now();
try {
  const result = await pool.query("SELECT NOW() as now, version()");
  console.log(`✓ Connected in ${Date.now() - start}ms`);
  console.log("DB time:", result.rows[0].now);
  console.log("DB version:", result.rows[0].version.split(",")[0]);
} catch (err) {
  console.error(`✗ Failed in ${Date.now() - start}ms`);
  console.error("  code:", err.code);
  console.error("  message:", err.message);
  if (err.cause) console.error("  cause:", err.cause);
} finally {
  await pool.end();
}
