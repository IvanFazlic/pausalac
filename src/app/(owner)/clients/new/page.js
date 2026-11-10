import { ClientFields } from "@/components/client-fields";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { createClientAction } from "@/lib/actions/clients";
import { requireOwner } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/company";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireOwner();
  const settings = await getSettings();

  return (
    <>
      <PageHeader title="New client" back={{ href: "/clients", label: "Clients" }} />
      <Card className="max-w-3xl p-5">
        <ActionForm action={createClientAction} className="space-y-5">
          <ClientFields defaultCurrency={settings.default_currency} defaultTerms={settings.payment_terms_days} />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <SubmitButton pendingLabel="Creating…">Create client</SubmitButton>
            <LinkButton href="/clients" variant="ghost">
              Cancel
            </LinkButton>
            <FormMessage />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
