import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

const COOKIE_NAME = "pausalac_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Only a hash of the session token is stored, so a database leak does not
// hand out usable sessions.
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, now() + make_interval(secs => ${MAX_AGE_SECONDS}))
  `;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  store.delete(COOKIE_NAME);
}

// Signs the user out everywhere except (optionally) the current browser.
export async function destroyOtherSessions(userId) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const keep = token ? hashToken(token) : "";
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token_hash <> ${keep}`;
}

// One lookup per request, shared by layouts, pages and actions.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.role, u.client_id, u.must_change_password
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > now()
      AND u.disabled_at IS NULL
  `;
  return rows[0] ?? null;
});

export function homePathFor(user) {
  return user.role === "owner" ? "/dashboard" : "/portal";
}

// The main account. Every owner page and every owner action starts with this.
export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/portal");
  return user;
}

// Everyone who uses the portal: a client login (its own client's invoices)
// or a read-only auditor login (every invoice). `allowPasswordChange` is only
// for the page where someone with a temporary password sets their own.
export async function requirePortalUser({ allowPasswordChange = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "owner") redirect("/dashboard");
  if (user.must_change_password && !allowPasswordChange) redirect("/portal/account");
  return user;
}

// Which invoices a signed-in user may read, as options for listInvoices() and
// getInvoice(). A client login is always pinned to its own client; only the
// main account and auditors get the unrestricted view. Anything else is
// refused rather than guessed.
export function invoiceScope(user) {
  if (user.role === "owner" || user.role === "auditor") return { clientId: null };
  if (user.role === "client" && user.client_id) return { clientId: user.client_id };
  throw new Error("This login has no access to invoices");
}
