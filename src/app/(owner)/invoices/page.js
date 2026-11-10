import Link from "next/link";
import { FileText, Plus, Repeat } from "lucide-react";
import { InvoiceFilters } from "@/components/invoice-filters";
import {
  Card,
  EmptyState,
  InvoiceStatusBadge,
  LinkButton,
  MoneyList,
  PageHeader,
  Table,
  Td,
  Th,
  rowClass,
} from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { listClients } from "@/lib/data/clients";
import { listInvoices } from "@/lib/data/invoices";
import { formatDate } from "@/lib/dates";
import { isUuid } from "@/lib/db";

export const metadata = { title: "Invoices" };

const STATUSES = ["issued", "overdue", "paid", "cancelled"];
const LIMIT = 300;

export default async function InvoicesPage({ searchParams }) {
  await requireOwner();
  const query = await searchParams;
  const status = STATUSES.includes(query.status) ? query.status : "";
  const clientId = isUuid(query.client) ? query.client : "";

  const [invoices, clients] = await Promise.all([
    listInvoices({ status: status || null, clientId: clientId || null, limit: LIMIT }),
    listClients({ includeArchived: true }),
  ]);
  const filtered = Boolean(status || clientId);

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <LinkButton href="/invoices/new">
            <Plus aria-hidden="true" />
            New invoice
          </LinkButton>
        }
      >
        <InvoiceFilters
          status={status}
          clientId={clientId}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        />
      </PageHeader>

      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtered ? "No invoices match this filter" : "No invoices yet"}
            description={
              filtered
                ? "Try another status or client."
                : "Issue your first invoice. It gets the next number and is locked once issued."
            }
            action={
              filtered ? (
                <LinkButton href="/invoices" variant="secondary">
                  Clear filters
                </LinkButton>
              ) : (
                <LinkButton href="/invoices/new">
                  <Plus aria-hidden="true" />
                  New invoice
                </LinkButton>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Client</Th>
                <Th>Issued</Th>
                <Th>Due</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className={rowClass}>
                  <Td>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="num inline-flex items-center gap-1.5 font-mono font-medium text-ink hover:text-accent"
                    >
                      {invoice.number}
                      {invoice.scheduled ? (
                        <Repeat className="size-3.5 text-faint" aria-label="Issued by a schedule" />
                      ) : null}
                    </Link>
                  </Td>
                  <Td className="max-w-64 truncate">
                    <Link href={`/clients/${invoice.client_id}`} className="text-muted hover:text-ink">
                      {invoice.client_name}
                    </Link>
                  </Td>
                  <Td className="num whitespace-nowrap text-muted">{formatDate(invoice.issue_date)}</Td>
                  <Td className="num whitespace-nowrap text-muted">{formatDate(invoice.due_date)}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    <MoneyList totals={invoice.totals} className="items-end" />
                  </Td>
                  <Td>
                    <InvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {invoices.length === LIMIT ? (
        <p className="mt-4 text-[13px] text-muted">Showing the {LIMIT} most recent invoices. Filter to narrow the list.</p>
      ) : null}
    </>
  );
}
