import { getCurrentUser, invoiceScope } from "@/lib/auth/session";
import { getInvoice } from "@/lib/data/invoices";
import { isUuid } from "@/lib/db";
import { invoiceFileName, renderInvoicePdf } from "@/lib/pdf/invoice-document";

// GET /api/invoices/:id/pdf            -> downloads the invoice
// GET /api/invoices/:id/pdf?inline=1   -> opens it in the browser
//
// The main account and read-only auditor logins can fetch any invoice. A
// client login can only fetch invoices issued to its own client; anything
// else is a 404.
export async function GET(request, { params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download this invoice.", { status: 401 });
  if (user.role !== "owner" && user.must_change_password) {
    return new Response("Set your password first.", { status: 403 });
  }
  if (!isUuid(id)) return new Response("Invoice not found.", { status: 404 });

  const invoice = await getInvoice(id, invoiceScope(user));
  if (!invoice) return new Response("Invoice not found.", { status: 404 });

  const pdf = await renderInvoicePdf(invoice);
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoiceFileName(invoice)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
