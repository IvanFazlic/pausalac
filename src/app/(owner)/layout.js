import { AppShell } from "@/components/app-shell";
import { requireOwner } from "@/lib/auth/session";

// Everything in this group is for the main account only. Each page and action
// also calls requireOwner() itself; the layout check alone is not relied on.
export default async function OwnerLayout({ children }) {
  const user = await requireOwner();
  return <AppShell user={user}>{children}</AppShell>;
}
