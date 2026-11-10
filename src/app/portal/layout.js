import { PortalShell } from "@/components/app-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";

export const metadata = { title: "Your invoices" };

// The portal. A client login sees its own client's invoices; a read-only
// auditor login sees every invoice. Neither sees anything else. Pages below
// re-check access themselves.
export default async function PortalLayout({ children }) {
  const user = await requirePortalUser({ allowPasswordChange: true });
  const label = user.role === "client" ? (await getClient(user.client_id))?.name ?? "" : "Read-only access";
  return (
    <PortalShell user={user} clientName={label}>
      {children}
    </PortalShell>
  );
}
