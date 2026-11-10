"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, inputClass } from "./classes";

const TABS = [
  ["", "All"],
  ["issued", "Unpaid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
];

function hrefFor(status, clientId) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (clientId) query.set("client", clientId);
  const text = query.toString();
  return text ? `/invoices?${text}` : "/invoices";
}

// Status tabs plus a client picker; both are plain URL parameters so a
// filtered list can be bookmarked or shared.
export function InvoiceFilters({ status, clientId, clients }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
        {TABS.map(([value, label]) => {
          const active = value === status;
          return (
            <Link
              key={value || "all"}
              href={hrefFor(value, clientId)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <select
        aria-label="Filter by client"
        value={clientId}
        onChange={(event) => router.push(hrefFor(status, event.target.value))}
        className={cn(inputClass, "h-8 w-auto max-w-56 text-[13px]")}
      >
        <option value="">All clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  );
}
