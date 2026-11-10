import { sql, transaction, isUniqueViolation } from "@/lib/db";
import { generatePassword, hashPassword, verifyPassword } from "@/lib/auth/password";

export async function ownerExists() {
  const rows = await sql`SELECT 1 FROM users WHERE role = 'owner' LIMIT 1`;
  return rows.length > 0;
}

// Creates the main account. Returns null if one already exists; the partial
// unique index on users makes this safe even if two requests race.
export async function createOwner({ name, email, password }) {
  const hash = await hashPassword(password);
  try {
    const rows = await sql`
      INSERT INTO users (email, name, password_hash, role)
      SELECT ${email}::text, ${name}::text, ${hash}::text, 'owner'
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
      RETURNING id
    `;
    return rows[0] ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function getUserForLogin(email) {
  const rows = await sql`
    SELECT id, email, name, role, client_id, password_hash, disabled_at
    FROM users
    WHERE lower(email) = ${email}
  `;
  return rows[0] ?? null;
}

export async function recordLogin(userId, email) {
  await transaction((db) => [
    db`UPDATE users SET last_login_at = now() WHERE id = ${userId}`,
    db`DELETE FROM login_attempts WHERE email = ${email}`,
  ]);
}

// --- login throttling --------------------------------------------------------

const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 40;

export async function isLoginThrottled(email, ip) {
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE email = ${email})::int AS by_email,
      count(*) FILTER (WHERE ip = ${ip})::int AS by_ip
    FROM login_attempts
    WHERE created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
  `;
  return rows[0].by_email >= MAX_PER_EMAIL || rows[0].by_ip >= MAX_PER_IP;
}

export async function recordFailedLogin(email, ip) {
  await transaction((db) => [
    db`INSERT INTO login_attempts (email, ip) VALUES (${email}, ${ip})`,
    db`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`,
  ]);
}

// --- own account -------------------------------------------------------------

export async function changeOwnPassword(userId, currentPassword, newPassword) {
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return { ok: false, reason: "wrong_password" };
  }
  const hash = await hashPassword(newPassword);
  await sql`
    UPDATE users SET password_hash = ${hash}, must_change_password = false WHERE id = ${userId}
  `;
  return { ok: true };
}

export async function updateOwnerProfile(userId, { name, email }) {
  try {
    await sql`
      UPDATE users SET name = ${name}, email = ${email} WHERE id = ${userId} AND role = 'owner'
    `;
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

// --- logins provisioned by the owner -------------------------------------------
//
// Two kinds, told apart by `scope`:
//   { role: "client", clientId }  sees the invoices of that one client
//   { role: "auditor" }           read-only, sees every invoice (accountant, tax office)
//
// Every statement below matches on both role and client, so an action meant
// for one client's logins can never touch another client's or an auditor's.

function scopeOf(scope) {
  if (scope.role === "client" && scope.clientId) return { role: "client", clientId: scope.clientId };
  if (scope.role === "auditor") return { role: "auditor", clientId: null };
  throw new Error("Unknown login scope");
}

async function listLogins(scope) {
  const { role, clientId } = scopeOf(scope);
  return sql`
    SELECT id, email, name, must_change_password, disabled_at, last_login_at, created_at
    FROM users
    WHERE role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
    ORDER BY created_at
  `;
}

// Returns the temporary password exactly once; only its hash is stored.
async function createLogin(scope, { email, name }) {
  const { role, clientId } = scopeOf(scope);
  const password = generatePassword();
  const hash = await hashPassword(password);
  try {
    const rows = await sql`
      INSERT INTO users (email, name, password_hash, role, client_id, must_change_password)
      VALUES (${email}, ${name}, ${hash}, ${role}, ${clientId}::uuid, true)
      RETURNING id, email
    `;
    return { ok: true, email: rows[0].email, password };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "email_taken" };
    throw error;
  }
}

async function resetLoginPassword(scope, userId) {
  const { role, clientId } = scopeOf(scope);
  const password = generatePassword();
  const hash = await hashPassword(password);
  const [updated] = await transaction((db) => [
    db`
      UPDATE users SET password_hash = ${hash}, must_change_password = true
      WHERE id = ${userId} AND role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
      RETURNING email
    `,
    db`
      DELETE FROM sessions
      WHERE user_id IN (
        SELECT id FROM users
        WHERE id = ${userId} AND role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
      )
    `,
  ]);
  if (!updated[0]) return { ok: false, reason: "not_found" };
  return { ok: true, email: updated[0].email, password };
}

async function setLoginDisabled(scope, userId, disabled) {
  const { role, clientId } = scopeOf(scope);
  await transaction((db) => [
    db`
      UPDATE users
      SET disabled_at = CASE WHEN ${disabled}::boolean THEN coalesce(disabled_at, now()) ELSE NULL END
      WHERE id = ${userId} AND role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
    `,
    db`
      DELETE FROM sessions
      WHERE ${disabled}::boolean
        AND user_id IN (
          SELECT id FROM users
          WHERE id = ${userId} AND role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
        )
    `,
  ]);
}

async function deleteLogin(scope, userId) {
  const { role, clientId } = scopeOf(scope);
  await sql`
    DELETE FROM users
    WHERE id = ${userId} AND role = ${role} AND client_id IS NOT DISTINCT FROM ${clientId}::uuid
  `;
}

// Client logins
export const listClientUsers = (clientId) => listLogins({ role: "client", clientId });
export const createClientUser = (clientId, data) => createLogin({ role: "client", clientId }, data);
export const resetClientUserPassword = (clientId, userId) => resetLoginPassword({ role: "client", clientId }, userId);
export const setClientUserDisabled = (clientId, userId, disabled) =>
  setLoginDisabled({ role: "client", clientId }, userId, disabled);
export const deleteClientUser = (clientId, userId) => deleteLogin({ role: "client", clientId }, userId);

// Read-only logins that see every invoice
const AUDITOR = { role: "auditor" };
export const listAuditors = () => listLogins(AUDITOR);
export const createAuditor = (data) => createLogin(AUDITOR, data);
export const resetAuditorPassword = (userId) => resetLoginPassword(AUDITOR, userId);
export const setAuditorDisabled = (userId, disabled) => setLoginDisabled(AUDITOR, userId, disabled);
export const deleteAuditor = (userId) => deleteLogin(AUDITOR, userId);
