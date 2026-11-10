"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { isUuid } from "@/lib/db";
import { createAuditor, deleteAuditor, resetAuditorPassword, setAuditorDisabled } from "@/lib/data/users";
import { clientUserSchema, formToObject, toFieldErrors } from "@/lib/validation";

// Read-only logins that see every invoice (accountant, tax office). Only the
// main account can create or change them.

export async function createAuditorAction(formData) {
  await requireOwner();
  const parsed = clientUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const result = await createAuditor(parsed.data);
  if (!result.ok) return { fieldErrors: { email: "This email already has a login." } };
  revalidatePath("/settings");
  return { ok: true, credentials: { email: result.email, password: result.password, kind: "new" } };
}

export async function resetAuditorPasswordAction(userId) {
  await requireOwner();
  if (!isUuid(userId)) return { error: "Login not found." };
  const result = await resetAuditorPassword(userId);
  if (!result.ok) return { error: "Login not found." };
  revalidatePath("/settings");
  return { ok: true, credentials: { email: result.email, password: result.password, kind: "reset" } };
}

export async function setAuditorDisabledAction(userId, disabled) {
  await requireOwner();
  if (!isUuid(userId)) return { error: "Login not found." };
  await setAuditorDisabled(userId, Boolean(disabled));
  revalidatePath("/settings");
}

export async function deleteAuditorAction(userId) {
  await requireOwner();
  if (!isUuid(userId)) return { error: "Login not found." };
  await deleteAuditor(userId);
  revalidatePath("/settings");
}
