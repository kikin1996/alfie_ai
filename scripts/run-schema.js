/**
 * Spustí supabase/schema.sql proti databázi.
 * Vyžaduje v .env.local: DATABASE_URL (Connection string z Supabase → Settings → Database)
 * Spuštění: node scripts/run-schema.js
 */
const { readFileSync } = require("fs");
const { join } = require("path");

// Načti .env.local (Next.js / běžná konvence)
require("dotenv").config({ path: join(__dirname, "..", ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Chybí DATABASE_URL v .env.local. Přidej Connection string z Supabase → Settings → Database.");
  process.exit(1);
}

async function run() {
  const pg = require("pg");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  const schemaPath = join(__dirname, "..", "supabase", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  try {
    await client.connect();
    await client.query(sql);
    console.log("Schema úspěšně spuštěno.");
  } catch (err) {
    console.error("Chyba:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
