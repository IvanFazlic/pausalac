"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { isUuid } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import {
  createClient,
  deleteClient,
  setClientArchived,
  setClientNextNumber,
  updateClient,
} from "@/lib/data/clients";
import {
  createClientUser,
  deleteClientUser,
  resetClientUserPassword,
  setClientUserDisabled,
} from "@/lib/data/users";
import {
  clientSchema,
  clientUserSchema,
  formToObject,
  nextNumberSchema,
  toFieldErrors,
} from "@/lib/validation";

const CHECK_FIELDS = "Check the highlighted fields.";

export async function createClientAction(formData) {
  await requireOwner();
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: toFieldErrors(parsed.error) };

  const id = await createClient(parsed.data);
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function updateClientAction(id, formData) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Client not found." };
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: toFieldErrors(parsed.error) };

  if (!(await updateClient(id, parsed.data))) return { error: "Client not found." };
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Saved. Invoices already issued keep the details they were issued with." };
}

// Next running number in this client's own series for the current year.
export async function setClientNextNumberAction(id, formData) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Client not found." };
  const parsed = nextNumberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  await setClientNextNumber(id, Number(todayISO().slice(0, 4)), parsed.data.next_number);
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Saved." };
}

export async function setClientArchivedAction(id, archived) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Client not found." };
  await setClientArchived(id, Boolean(archived));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function deleteClientAction(id) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Client not found." };
  if (!(await deleteClient(id))) {
    return { error: "This client has invoices, so it cannot be deleted. Archive it instead." };
  }
  revalidatePath("/clients");
  redirect("/clients");
}

// --- portal logins for a client ------------------------------------------------

export async function createClientUserAction(clientId, formData) {
  await requireOwner();
  if (!isUuid(clientId)) return { error: "Client not found." };
  const parsed = clientUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const result = await createClientUser(clientId, parsed.data);
  if (!result.ok) {
    return { fieldErrors: { email: "This email already has a login." } };
  }
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, credentials: { email: result.email, password: result.password, kind: "new" } };
}

export async function resetClientUserPasswordAction(clientId, userId) {
  await requireOwner();
  if (!isUuid(clientId) || !isUuid(userId)) return { error: "Login not found." };
  const result = await resetClientUserPassword(clientId, userId);
  if (!result.ok) return { error: "Login not found." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, credentials: { email: result.email, password: result.password, kind: "reset" } };
}

export async function setClientUserDisabledAction(clientId, userId, disabled) {
  await requireOwner();
  if (!isUuid(clientId) || !isUuid(userId)) return { error: "Login not found." };
  await setClientUserDisabled(clientId, userId, Boolean(disabled));
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientUserAction(clientId, userId) {
  await requireOwner();
  if (!isUuid(clientId) || !isUuid(userId)) return { error: "Login not found." };
  await deleteClientUser(clientId, userId);
  revalidatePath(`/clients/${clientId}`);
}
