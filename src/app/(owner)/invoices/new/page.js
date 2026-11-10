import { Building2, Users } from "lucide-react";
import { InvoiceForm } from "@/components/invoice-form";
import { Callout, LinkButton, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { listClientOptions } from "@/lib/data/clients";
import { getCompany, getNumbering, getSettings } from "@/lib/data/company";
import { todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/db";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }) {
  await requireOwner();
  const query = await searchParams;
  const today = todayISO();

  const [company, settings, clients, numbering] = await Promise.all([
    getCompany(),
    getSettings(),
    listClientOptions(Number(today.slice(0, 4))),
    getNumbering(today),
  ]);

  return (
    <>
      <PageHeader title="New invoice" back={{ href: "/invoices", label: "Invoices" }} />

      {!company ? (
        <Callout
          tone="accent"
          icon={Building2}
          title="Add your company details first"
          action={
            <LinkButton href="/settings" size="sm">
              Open settings
            </LinkButton>
          }
        >
          An invoice needs your name, address, PIB and bank account.
        </Callout>
      ) : clients.length === 0 ? (
        <Callout
          tone="accent"
          icon={Users}
          title="Add a client first"
          action={
            <LinkButton href="/clients/new" size="sm">
              New client
            </LinkButton>
          }
        >
          Invoices are issued to a client.
        </Callout>
      ) : (
        <InvoiceForm
          clients={clients}
          defaults={settings}
          today={today}
          initialClientId={isUuid(query.client) ? query.client : ""}
          numbering={{ format: numbering.format, next_number: numbering.next_number }}
        />
      )}
    </>
  );
}
