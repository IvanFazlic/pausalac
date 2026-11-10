import { AuthShell } from "@/components/app-shell";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <AuthShell title="Page not found" description="This page does not exist, or you do not have access to it.">
      <LinkButton href="/" variant="secondary" className="w-full">
        Go to the start page
      </LinkButton>
    </AuthShell>
  );
}
