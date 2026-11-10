"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { saveCompany, saveSettings, setNextNumber } from "@/lib/data/company";
import { updateOwnerProfile } from "@/lib/data/users";
import {
  companySchema,
  formToObject,
  nextNumberSchema,
  ownerProfileSchema,
  settingsSchema,
  toFieldErrors,
} from "@/lib/validation";

const CHECK_FIELDS = "Check the highlighted fields.";

export async function saveCompanyAction(formData) {
  await requireOwner();
  const parsed = companySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: toFieldErrors(parsed.error) };

  const { changed } = await saveCompany(parsed.data);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: changed
      ? "Saved. New invoices will use these details; invoices already issued are unchanged."
      : "No changes to save.",
  };
}

export async function saveSettingsAction(formData) {
  await requireOwner();
  const parsed = settingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: toFieldErrors(parsed.error) };

  await saveSettings(parsed.data);
  revalidatePath("/settings");
  return { ok: true, message: "Saved. These defaults apply to new invoices." };
}

export async function setNextNumberAction(formData) {
  await requireOwner();
  const parsed = nextNumberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const year = Number(todayISO().slice(0, 4));
  if (!(await setNextNumber(year, parsed.data.next_number))) {
    return {
      fieldErrors: { next_number: `An invoice with this or a higher number already exists in ${year}.` },
    };
  }
  revalidatePath("/settings");
  return { ok: true, message: "Saved." };
}

export async function updateOwnerProfileAction(formData) {
  const user = await requireOwner();
  const parsed = ownerProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const result = await updateOwnerProfile(user.id, parsed.data);
  if (!result.ok) return { fieldErrors: { email: "This email is already used by another login." } };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}
