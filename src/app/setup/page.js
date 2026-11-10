import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app-shell";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { setupAction } from "@/lib/actions/auth";
import { ownerExists } from "@/lib/data/users";

export const metadata = { title: "Set up" };

// Depends on live database state, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

// First run only. Once the main account exists this page redirects to sign-in
// and the action refuses to create another one.
export default async function SetupPage() {
  if (await ownerExists()) redirect("/login");

  return (
    <AuthShell
      title="Create the main account"
      description="This account manages company details, clients, invoices and client logins. There is only one."
    >
      <ActionForm action={setupAction} className="space-y-4">
        <Field label="Your name" name="name">
          <Input name="name" autoComplete="name" autoFocus required maxLength={120} />
        </Field>
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Password" name="password" hint="At least 8 characters.">
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <FormMessage />
        <SubmitButton size="lg" className="w-full" pendingLabel="Creating…">
          Create account
        </SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
