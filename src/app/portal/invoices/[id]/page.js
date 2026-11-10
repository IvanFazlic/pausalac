import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/classes";
import { InvoiceView } from "@/components/invoice-view";
import { InvoiceStatusBadge, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth/session";
import { getInvoice } from "@/lib/data/invoices";
import { isUuid } from "@/lib/db";

export default async function PortalInvoicePage({ params }) {
  const user = await requireClient();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // An invoice that belongs to another client is indistinguishable from one
  // that does not exist.
  const invoice = await getInvoice(id, { clientId: user.client_id });
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
        back={{ href: "/portal", label: "Your invoices" }}
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
      <InvoiceView invoice={invoice} />
    </>
  );
}
