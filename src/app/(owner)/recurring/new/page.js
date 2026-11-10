import { Building2, Users } from "lucide-react";
import { RecurringForm } from "@/components/recurring-form";
import { Callout, LinkButton, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { listClientOptions } from "@/lib/data/clients";
import { getCompany, getSettings } from "@/lib/data/company";
import { todayISO } from "@/lib/dates";

export const metadata = { title: "New schedule" };

export default async function NewSchedulePage() {
  await requireOwner();
  const [company, settings, clients] = await Promise.all([getCompany(), getSettings(), listClientOptions()]);

  return (
    <>
      <PageHeader title="New recurring invoice" back={{ href: "/recurring", label: "Recurring invoices" }} />

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
          Scheduled invoices need your name, address, PIB and bank account.
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
          A schedule issues invoices to one client.
        </Callout>
      ) : (
        <RecurringForm clients={clients} defaults={settings} today={todayISO()} />
      )}
    </>
  );
}
