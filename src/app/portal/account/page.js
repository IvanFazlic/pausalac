import { KeyRound } from "lucide-react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { Callout, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { changePasswordAction } from "@/lib/actions/auth";
import { requireClient } from "@/lib/auth/session";

export const metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const user = await requireClient({ allowPasswordChange: true });
  const firstSignIn = user.must_change_password;

  return (
    <>
      <PageHeader
        title={firstSignIn ? "Choose your password" : "Account"}
        description={`Signed in as ${user.email}`}
        back={firstSignIn ? undefined : { href: "/portal", label: "Your invoices" }}
      />

      <div className="max-w-xl space-y-6">
        {firstSignIn ? (
          <Callout tone="accent" icon={KeyRound} title="One step before your invoices">
            You signed in with a temporary password. Choose your own to continue.
          </Callout>
        ) : null}

        <Card>
          <CardHeader title="Password" />
          <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-5 p-5">
            <Field label={firstSignIn ? "Temporary password" : "Current password"} name="currentPassword">
              <Input name="currentPassword" type="password" autoComplete="current-password" />
            </Field>
            <Field label="New password" name="newPassword" hint="At least 8 characters.">
              <Input name="newPassword" type="password" autoComplete="new-password" />
            </Field>
            <Field label="Repeat new password" name="confirmPassword">
              <Input name="confirmPassword" type="password" autoComplete="new-password" />
            </Field>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <SubmitButton>{firstSignIn ? "Save and continue" : "Change password"}</SubmitButton>
              <FormMessage />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
