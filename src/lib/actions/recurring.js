"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { isUuid } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  runDueSchedules,
  setScheduleActive,
  updateSchedule,
} from "@/lib/data/recurring";
import { recurringSchema, toFieldErrors } from "@/lib/validation";

const PAST_DATE = "Choose today or a later date.";

function revalidateSchedules() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
}

export async function createScheduleAction(payload) {
  await requireOwner();
  const parsed = recurringSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  if (parsed.data.nextDate < todayISO()) {
    return { error: "Check the highlighted fields.", fieldErrors: { nextDate: PAST_DATE } };
  }

  await createSchedule(parsed.data);
  revalidateSchedules();
  redirect("/recurring");
}

export async function updateScheduleAction(id, payload) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Schedule not found." };
  const parsed = recurringSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const current = await getSchedule(id);
  if (!current) return { error: "Schedule not found." };
  // A date in the past is only refused when it is being changed to one.
  if (parsed.data.nextDate !== current.next_run_date && parsed.data.nextDate < todayISO()) {
    return { error: "Check the highlighted fields.", fieldErrors: { nextDate: PAST_DATE } };
  }

  await updateSchedule(id, parsed.data);
  revalidateSchedules();
  revalidatePath(`/recurring/${id}`);
  redirect("/recurring");
}

export async function setScheduleActiveAction(id, active) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Schedule not found." };
  await setScheduleActive(id, Boolean(active));
  revalidateSchedules();
  revalidatePath(`/recurring/${id}`);
}

export async function deleteScheduleAction(id) {
  await requireOwner();
  if (!isUuid(id)) return { error: "Schedule not found." };
  await deleteSchedule(id);
  revalidateSchedules();
  redirect("/recurring");
}

// Issues everything that is due right now, without waiting for the daily run.
export async function runDueNowAction() {
  await requireOwner();
  const result = await runDueSchedules();
  revalidateSchedules();
  revalidatePath("/invoices");
  revalidatePath("/portal", "layout");

  if (result.errors.length > 0) {
    return { error: `Issued ${result.created.length}; ${result.errors.length} failed: ${result.errors[0].message}` };
  }
  if (result.created.length === 0) return { message: "Nothing is due today." };
  const numbers = result.created.map((invoice) => invoice.number).join(", ");
  return { message: `Issued ${result.created.length === 1 ? "invoice" : "invoices"} ${numbers}.` };
}
