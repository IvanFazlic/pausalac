import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, ExternalLink, Lock, Undo2 } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { buttonClass } from "@/components/classes";
import { InvoiceView } from "@/components/invoice-view";
import { Card, InvoiceStatusBadge, PageHeader } from "@/components/ui";
import {
  cancelInvoiceAction,
  markInvoicePaidAction,
  markInvoiceUnpaidAction,
} from "@/lib/actions/invoices";
import { getCurrentUser, requireOwner } from "@/lib/auth/session";
import { getInvoice } from "@/lib/data/invoices";
import { formatDateTime } from "@/lib/dates";
import { isUuid } from "@/lib/db";

// Metadata is resolved separately from the page, so it does its own check
// before reading anything about the invoice.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const invoice = user?.role === "owner" && isUuid(id) ? await getInvoice(id) : null;
  return { title: invoice ? `Invoice ${invoice.number}` : "Invoice" };
}

function Fact({ label, children }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

export default async function InvoicePage({ params }) {
  await requireOwner();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const pdfUrl = `/api/invoices/${invoice.id}/pdf`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>
              Invoice <span className="num font-mono">{invoice.number}</span>
            </span>
            <InvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
          </span>
        }
        back={{ href: "/invoices", label: "Invoices" }}
        actions={
          <>
            <a href={`${pdfUrl}?inline=1`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary" })}>
              <ExternalLink aria-hidden="true" />
              Open PDF
            </a>
            <a href={pdfUrl} download className={buttonClass()}>
              <Download aria-hidden="true" />
              Download PDF
            </a>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <InvoiceView invoice={invoice} />

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-ink">Status</h2>
            {invoice.status === "issued" ? (
              <div className="flex flex-col items-start gap-3">
                <ActionButton variant="primary" action={markInvoicePaidAction.bind(null, invoice.id)}>
                  <Check aria-hidden="true" />
                  Mark as paid
                </ActionButton>
                <ActionButton
                  variant="danger"
                  confirm="Cancel this invoice? This cannot be undone."
                  confirmLabel="Cancel invoice"
                  action={cancelInvoiceAction.bind(null, invoice.id)}
                >
                  Cancel invoice
                </ActionButton>
              </div>
            ) : null}
            {invoice.status === "paid" ? (
              <ActionButton action={markInvoiceUnpaidAction.bind(null, invoice.id)}>
                <Undo2 aria-hidden="true" />
                Mark as unpaid
              </ActionButton>
            ) : null}
            {invoice.status === "cancelled" ? (
              <p className="text-[13px] leading-relaxed text-muted">
                This invoice is cancelled. It stays on record with its number, and the client still sees it
                marked as cancelled.
              </p>
            ) : null}

            <dl className="space-y-2 border-t border-line pt-4">
              <Fact label="Client">
                <Link href={`/clients/${invoice.client_id}`} className="font-medium text-accent hover:underline">
                  {invoice.client_snapshot.name}
                </Link>
              </Fact>
              <Fact label="Recorded">{formatDateTime(invoice.created_at)}</Fact>
              {invoice.paid_at ? <Fact label="Paid">{formatDateTime(invoice.paid_at)}</Fact> : null}
              {invoice.cancelled_at ? <Fact label="Cancelled">{formatDateTime(invoice.cancelled_at)}</Fact> : null}
              {invoice.scheduled_for ? (
                <Fact label="Source">
                  {invoice.recurring_invoice_id ? (
                    <Link href={`/recurring/${invoice.recurring_invoice_id}`} className="font-medium text-accent hover:underline">
                      Recurring schedule
                    </Link>
                  ) : (
                    "Recurring schedule"
                  )}
                </Fact>
              ) : null}
            </dl>
          </Card>

          <p className="flex gap-2 px-1 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            This invoice is locked. It shows your company details and the client&apos;s details exactly as they
            were when it was issued, even if you change them later.
          </p>
        </div>
      </div>
    </>
  );
}
