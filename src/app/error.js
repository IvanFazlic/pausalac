"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/classes";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Something went wrong</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          The page could not be loaded. Nothing was changed. Try again, and if it keeps happening check that
          the database is reachable.
        </p>
        {error?.digest ? <p className="mt-3 font-mono text-xs text-faint">Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()} className={buttonClass({ className: "mt-6 w-full" })}>
          Try again
        </button>
      </div>
    </div>
  );
}
