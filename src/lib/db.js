import { neon } from "@neondatabase/serverless";

let client;

// Created lazily so `next build` does not need DATABASE_URL.
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local`.");
    }
    client = neon(url);
  }
  return client;
}

// Tagged-template shortcut: await sql`SELECT ... WHERE id = ${id}`
export function sql(strings, ...values) {
  return getSql()(strings, ...values);
}

// Runs the given queries in one atomic transaction (single round trip).
export function transaction(buildQueries) {
  const db = getSql();
  return db.transaction(buildQueries(db));
}

export function isUniqueViolation(error, constraint) {
  if (error?.code !== "23505") return false;
  return constraint ? error.constraint === constraint : true;
}

export function isForeignKeyViolation(error) {
  return error?.code === "23503" || error?.code === "23001";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}
