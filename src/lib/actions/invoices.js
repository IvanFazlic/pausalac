"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { isUuid } from "@/lib/db";
import {
  InvoiceError,
  cancelInvoice,
  createInvoice,
  markInvoicePaid,
  markInvoiceUnpaid,
} from "@/lib/data/invoices";
import { invoiceSchema, toFieldErrors } from "@/lib/validation";

function revalidateInvoice(id) {
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/portal", "layout");
}

// `payload` is the plain object built by the invoice form.
export async function createInvoiceAction(payload) {
  await requireOwner();
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  let invoice;
  try {
    invoice = await createInvoice(parsed.data);
  } catch (error) {
    if (error instanceof InvoiceError) return { error: error.message };
    throw error;
  }

  revalidateInvoice(invoice.id);
  redirect(`/invoices/${invoice.id}`);
}

export async function markInvoicePaidAction(id) {
  await requireOwner();
  if (!isUuid(id) || !(await markInvoicePaid(id))) {
    return { error: "Only an unpaid invoice can be marked as paid." };
  }
  revalidateInvoice(id);
}

export async function markInvoiceUnpaidAction(id) {
  await requireOwner();
  if (!isUuid(id) || !(await markInvoiceUnpaid(id))) {
    return { error: "This invoice is not marked as paid." };
  }
  revalidateInvoice(id);
}

export async function cancelInvoiceAction(id) {
  await requireOwner();
  if (!isUuid(id) || !(await cancelInvoice(id))) {
    return { error: "Only an unpaid invoice can be cancelled." };
  }
  revalidateInvoice(id);
}
