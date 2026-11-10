import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app-shell";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";
import { loginAction } from "@/lib/actions/auth";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { ownerExists } from "@/lib/data/users";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  if (!(await ownerExists())) redirect("/setup");

  return (
    <AuthShell
      title="Sign in"
      description="Use the email and password for your account."
      footer="Clients: your login is created by the business that invoices you. Ask them if you need access or a new password."
    >
      <ActionForm action={loginAction} className="space-y-4">
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="username" autoFocus required />
        </Field>
        <Field label="Password" name="password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage />
        <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
