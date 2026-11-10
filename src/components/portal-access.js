"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, LoaderCircle, UserPlus } from "lucide-react";
import {
  createClientUserAction,
  deleteClientUserAction,
  resetClientUserPasswordAction,
  setClientUserDisabledAction,
} from "@/lib/actions/clients";
import { ActionButton } from "./action-button";
import { buttonClass, inputClass, labelClass } from "./classes";
import { ActionForm, FieldError, SubmitButton } from "./form";

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the value is visible and can be selected.
    }
  }
  return (
    <button type="button" onClick={copy} className={buttonClass({ variant: "secondary", size: "sm" })}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

// Shown once, right after a login is created or its password is reset.
function Credentials({ credentials, loginUrl, onDismiss }) {
  const text = `Sign in: ${loginUrl}\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}`;
  return (
    <div className="rounded-xl border border-accent/25 bg-accent-soft p-4" role="status">
      <p className="text-sm font-medium text-ink">
        {credentials.kind === "reset" ? "New temporary password" : "Login created"}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Send these details to the client. The password is shown only now, and they will be asked to choose
        their own when they first sign in.
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">Email</dt>
          <dd className="min-w-0 break-all text-ink">{credentials.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">Password</dt>
          <dd className="font-mono font-medium text-ink select-all">{credentials.password}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton value={text} label="Copy sign-in details" />
        <button type="button" onClick={onDismiss} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Done
        </button>
      </div>
    </div>
  );
}

function ResetButton({ clientId, userId, onCredentials }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass({ variant: "secondary", size: "sm" })}
      onClick={() =>
        startTransition(async () => {
          const result = await resetClientUserPasswordAction(clientId, userId);
          if (result?.credentials) onCredentials(result.credentials);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
      Reset password
    </button>
  );
}

function statusOf(user) {
  if (user.disabled_at) return ["Disabled", "text-danger"];
  if (user.must_change_password) return ["Waiting for first sign-in", "text-warning"];
  return ["Active", "text-success"];
}

// Logins the main account provisions for one client. A client login can only
// ever see that client's invoices.
export function PortalAccess({ clientId, users, loginUrl }) {
  const [credentials, setCredentials] = useState(null);

  return (
    <div className="space-y-5 p-5">
      {credentials ? (
        <Credentials credentials={credentials} loginUrl={loginUrl} onDismiss={() => setCredentials(null)} />
      ) : null}

      {users.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {users.map((user) => {
            const [status, tone] = statusOf(user);
            return (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{user.email}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {user.name ? `${user.name} · ` : ""}
                    <span className={tone}>{status}</span>
                    {user.last_login_label ? ` · last sign-in ${user.last_login_label}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ResetButton clientId={clientId} userId={user.id} onCredentials={setCredentials} />
                  <ActionButton
                    size="sm"
                    action={setClientUserDisabledAction.bind(null, clientId, user.id, !user.disabled_at)}
                  >
                    {user.disabled_at ? "Enable" : "Disable"}
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="danger"
                    confirm="Remove this login?"
                    confirmLabel="Remove"
                    action={deleteClientUserAction.bind(null, clientId, user.id)}
                  >
                    Remove
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          This client has no login yet. Create one so they can see and download their invoices.
        </p>
      )}

      <ActionForm
        action={createClientUserAction.bind(null, clientId)}
        resetOnSuccess
        onResult={(result) => {
          if (result?.credentials) setCredentials(result.credentials);
        }}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
      >
        <div>
          <label htmlFor="portal-email" className={labelClass}>
            Email
          </label>
          <input
            id="portal-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="name@client.com"
            className={`${inputClass} mt-1.5`}
          />
          <FieldError name="email" />
        </div>
        <div>
          <label htmlFor="portal-name" className={labelClass}>
            Name (optional)
          </label>
          <input id="portal-name" name="name" autoComplete="off" className={`${inputClass} mt-1.5`} />
          <FieldError name="name" />
        </div>
        <div className="sm:pt-[1.6rem]">
          <SubmitButton variant="secondary" pendingLabel="Creating…">
            <UserPlus aria-hidden="true" />
            Create login
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
