import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ClientFields } from "@/components/client-fields";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { PortalAccess } from "@/components/portal-access";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  InvoiceStatusBadge,
  LinkButton,
  MoneyList,
  PageHeader,
  Table,
  Td,
  Th,
  rowClass,
} from "@/components/ui";
import {
  deleteClientAction,
  setClientArchivedAction,
  setClientNextNumberAction,
  updateClientAction,
} from "@/lib/actions/clients";
import { requireOwner } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { getSettings } from "@/lib/data/company";
import { listInvoices } from "@/lib/data/invoices";
import { listClientUsers } from "@/lib/data/users";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/db";
import { formatInvoiceNumber, usesRunningNumber } from "@/lib/numbering";

export const metadata = { title: "Client" };

async function loginUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/login`;
}

export default async function ClientPage({ params }) {
  await requireOwner();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const [client, settings, users, invoices, url] = await Promise.all([
    getClient(id, year),
    getSettings(),
    listClientUsers(id),
    listInvoices({ clientId: id }),
    loginUrl(),
  ]);
  if (!client) notFound();

  const archived = Boolean(client.archived_at);
  const ownSeries = Boolean(client.number_format);
  const runningNumber = usesRunningNumber(client.number_format);
  const nextNumber = ownSeries
    ? formatInvoiceNumber(client.number_format, runningNumber ? client.next_seq : null, today)
    : null;
  const portalUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    must_change_password: user.must_change_password,
    disabled_at: user.disabled_at ? "disabled" : null,
    last_login_label: user.last_login_at ? formatDateTime(user.last_login_at) : null,
  }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {client.name}
            {archived ? <Badge>Archived</Badge> : null}
          </span>
        }
        back={{ href: "/clients", label: "Clients" }}
        actions={
          archived ? null : (
            <LinkButton href={`/invoices/new?client=${client.id}`}>
              <Plus aria-hidden="true" />
              New invoice
            </LinkButton>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader
            title="Details"
            description="Changes apply to future invoices. Invoices already issued keep the details they were issued with."
          />
          <ActionForm action={updateClientAction.bind(null, client.id)} className="space-y-5 p-5">
            <ClientFields client={client} defaultTerms={settings.payment_terms_days} />
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <SubmitButton>Save changes</SubmitButton>
              <FormMessage />
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Portal access"
              description="A login lets this client see and download their own invoices. They cannot see other clients, your settings or anything else."
            />
            <PortalAccess clientId={client.id} users={portalUsers} loginUrl={url} />
          </Card>

          {ownSeries ? (
            <Card>
              <CardHeader
                title="Numbering"
                description={
                  runningNumber
                    ? `This client has its own series. The next invoice issued today would be ${nextNumber}.`
                    : `This client's numbers come from the issue date. An invoice issued today would be ${nextNumber}; a second one in the same month gets “-2”.`
                }
              />
              {runningNumber ? (
                <ActionForm action={setClientNextNumberAction.bind(null, client.id)} className="space-y-4 p-5">
                  <Field label={`Next running number in ${year}`} name="next_number" className="max-w-xs">
                    <Input name="next_number" inputMode="numeric" defaultValue={client.next_seq} className="num" />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <SubmitButton variant="secondary">Save number</SubmitButton>
                    <FormMessage />
                  </div>
                </ActionForm>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={archived ? "Archived" : "Archive"}
              description={
                archived
                  ? "This client is hidden from pickers and recurring invoices for it are paused."
                  : "Hide this client from pickers. Its invoices and logins are kept."
              }
            />
            <div className="flex flex-wrap items-center gap-3 p-5">
              <ActionButton action={setClientArchivedAction.bind(null, client.id, !archived)}>
                {archived ? "Restore client" : "Archive client"}
              </ActionButton>
              {client.invoice_count === 0 ? (
                <ActionButton
                  variant="danger"
                  confirm="Delete this client and its logins?"
                  confirmLabel="Delete"
                  action={deleteClientAction.bind(null, client.id)}
                >
                  Delete client
                </ActionButton>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Invoices" />
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices for this client yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
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
                    <Link href={`/invoices/${invoice.id}`} className="num font-mono font-medium text-ink hover:text-accent">
                      {invoice.number}
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
    </>
  );
}
