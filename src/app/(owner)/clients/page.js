import Link from "next/link";
import { Plus, Users } from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
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

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }) {
  await requireOwner();
  const showArchived = (await searchParams).archived === "1";
  const clients = await listClients({ includeArchived: showArchived });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone you invoice. Each client can have a login that shows only their own invoices."
        actions={
          <LinkButton href="/clients/new">
            <Plus aria-hidden="true" />
            New client
          </LinkButton>
        }
      />

      <Card>
        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add a client to start issuing invoices to them."
            action={
              <LinkButton href="/clients/new">
                <Plus aria-hidden="true" />
                New client
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>PIB / Tax ID</Th>
                <Th>Currency</Th>
                <Th align="right">Invoices</Th>
                <Th align="right">Unpaid</Th>
                <Th>Portal</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className={rowClass}>
                  <Td>
                    <Link href={`/clients/${client.id}`} className="font-medium text-ink hover:text-accent">
                      {client.name}
                    </Link>
                    {client.archived_at ? (
                      <Badge className="ml-2">Archived</Badge>
                    ) : null}
                    {client.email ? <p className="mt-0.5 text-xs text-muted">{client.email}</p> : null}
                  </Td>
                  <Td className="num text-muted">{client.pib || "—"}</Td>
                  <Td className="text-muted">{client.default_currency}</Td>
                  <Td align="right" className="num text-muted">{client.invoice_count}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    <MoneyList totals={client.outstanding} className="items-end" />
                  </Td>
                  <Td>
                    {client.account_count > 0 ? (
                      <Badge tone="success">
                        {client.account_count} {client.account_count === 1 ? "login" : "logins"}
                      </Badge>
                    ) : (
                      <span className="text-[13px] text-faint">No login</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-[13px] text-muted">
        {showArchived ? (
          <Link href="/clients" className="hover:text-ink hover:underline">
            Hide archived clients
          </Link>
        ) : (
          <Link href="/clients?archived=1" className="hover:text-ink hover:underline">
            Show archived clients
          </Link>
        )}
      </p>
    </>
  );
}
