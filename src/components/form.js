"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { buttonClass, cn } from "./classes";

const FormContext = createContext({ state: null, pending: false });

export function useFormState() {
  return useContext(FormContext);
}

// A form that calls a server action and keeps what the user typed when the
// action reports validation errors. The action receives FormData and returns
// { ok?, message?, error?, fieldErrors? } (or redirects).
export function ActionForm({ action, children, className, resetOnSuccess = false, onResult }) {
  const [state, setState] = useState(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = (await action(data)) ?? null;
      setState(result);
      if (result?.ok && resetOnSuccess) form.reset();
      onResult?.(result);
    });
  }

  return (
    <FormContext value={{ state, pending }}>
      <form onSubmit={onSubmit} className={className} noValidate>
        {children}
      </form>
    </FormContext>
  );
}

export function FieldError({ name, message }) {
  const { state } = useFormState();
  const text = message ?? state?.fieldErrors?.[name];
  if (!text) return null;
  return (
    <p className="mt-1.5 text-xs text-danger" role="alert">
      {text}
    </p>
  );
}

// Form-level result: an error, or a short confirmation after saving.
export function FormMessage({ className }) {
  const { state, pending } = useFormState();
  if (pending || !state) return null;
  if (state.error) return <Notice tone="danger" className={className}>{state.error}</Notice>;
  if (state.message) return <Notice tone="success" className={className}>{state.message}</Notice>;
  return null;
}

export function Notice({ tone = "danger", children, className }) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 text-sm",
        tone === "success" ? "text-success" : "text-danger",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function SubmitButton({ children, pendingLabel = "Saving…", variant, size, className }) {
  const { pending } = useFormState();
  return (
    <button type="submit" disabled={pending} className={buttonClass({ variant, size, className })}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
