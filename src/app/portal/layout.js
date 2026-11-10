import { PortalShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";

export const metadata = { title: "Your invoices" };

// The client portal. A client login sees its own client's invoices and its own
// account page, nothing else. Pages below re-check access themselves.
export default async function PortalLayout({ children }) {
  const user = await requireClient({ allowPasswordChange: true });
  const client = await getClient(user.client_id);
  return (
    <PortalShell user={user} clientName={client?.name ?? ""}>
      {children}
    </PortalShell>
  );
}
