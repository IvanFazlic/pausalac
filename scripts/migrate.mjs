// Applies db/migrations/*.sql in order, once each.
//
//   npm run db:migrate
//
// Uses DATABASE_URL_UNPOOLED (or DATABASE_URL) from the environment, falling
// back to .env.local. Each migration runs in its own transaction.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@neondatabase/serverless";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  const envFile = path.join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
  process.exit(1);
}

const dir = path.join(root, "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("done");
      count += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      console.log("failed");
      throw error;
    }
  }

  const { rows: dbRows } = await client.query("SELECT current_database() AS db");
  console.log(
    count === 0
      ? `Database "${dbRows[0].db}" is up to date.`
      : `Applied ${count} migration(s) to "${dbRows[0].db}".`
  );
} finally {
  await client.end();
}
