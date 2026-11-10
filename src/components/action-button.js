"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { buttonClass } from "./classes";

// A button that runs a server action. With `confirm` it asks first, inline,
// instead of using a browser dialog. The action may return { error } or
// { message } to show next to the button.
export function ActionButton({
  action,
  children,
  variant = "secondary",
  size = "md",
  confirm,
  confirmLabel = "Yes",
  className,
}) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const outcome = (await action()) ?? null;
      setResult(outcome);
      setArmed(false);
    });
  }

  if (confirm && armed) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{confirm}</span>
        <button type="button" onClick={run} disabled={pending} className={buttonClass({ variant: "danger", size })}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={pending}
          className={buttonClass({ variant: "ghost", size })}
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => (confirm ? setArmed(true) : run())}
        disabled={pending}
        className={buttonClass({ variant, size, className })}
      >
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </button>
      {result?.error ? (
        <span role="alert" className="text-sm text-danger">
          {result.error}
        </span>
      ) : null}
      {result?.message ? (
        <span role="status" className="text-sm text-muted">
          {result.message}
        </span>
      ) : null}
    </span>
  );
}
