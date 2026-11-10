"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroyOtherSessions,
  destroySession,
  getCurrentUser,
  homePathFor,
} from "@/lib/auth/session";
import {
  changeOwnPassword,
  createOwner,
  getUserForLogin,
  isLoginThrottled,
  recordFailedLogin,
  recordLogin,
} from "@/lib/data/users";
import {
  changePasswordSchema,
  formToObject,
  loginSchema,
  setupSchema,
  toFieldErrors,
} from "@/lib/validation";

async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function loginAction(formData) {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { email, password } = parsed.data;
  const ip = await clientIp();

  if (await isLoginThrottled(email, ip)) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }

  const user = await getUserForLogin(email);
  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyAgainstDummy(password);

  // Same answer for unknown email, wrong password and disabled login.
  if (!user || !valid || user.disabled_at) {
    await recordFailedLogin(email, ip);
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  await recordLogin(user.id, email);
  redirect(homePathFor(user));
}

// First run only: creates the main account. Refuses once one exists.
export async function setupAction(formData) {
  const parsed = setupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const owner = await createOwner(parsed.data);
  if (!owner) return { error: "The main account already exists. Sign in instead." };

  await createSession(owner.id);
  redirect("/settings?welcome=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// For whoever is signed in (the owner in Settings, a client in the portal).
export async function changePasswordAction(formData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const result = await changeOwnPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) return { fieldErrors: { currentPassword: "That is not your current password." } };

  await destroyOtherSessions(user.id);
  if (user.role !== "owner" && user.must_change_password) redirect("/portal");
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}
