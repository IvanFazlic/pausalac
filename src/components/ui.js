import Link from "next/link";
import { buttonClass, cn, inputClass, labelClass, textareaClass } from "./classes";
import { FieldError } from "./form";
import { formatMoney } from "@/lib/money";

export function LinkButton({ href, variant, size, className, children, ...props }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, back, actions, children }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8">
      {back ? (
        <Link href={back.href} className="-mb-1 w-fit text-[13px] text-muted hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <section
      className={cn("rounded-xl border border-line bg-surface shadow-card", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, name, hint, error, className, children }) {
  return (
    <div className={className}>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p> : null}
      <FieldError name={name} message={error} />
    </div>
  );
}

export function Input({ className, name, id, ...props }) {
  return <input id={id ?? name} name={name} className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, name, id, children, ...props }) {
  return (
    <select id={id ?? name} name={name} className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, name, id, ...props }) {
  return <textarea id={id ?? name} name={name} className={cn(textareaClass, className)} {...props} />;
}

const BADGE_TONES = {
  neutral: "bg-surface-2 text-muted",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status, overdue }) {
  if (status === "paid") return <Badge tone="success">Paid</Badge>;
  if (status === "cancelled") return <Badge tone="neutral">Cancelled</Badge>;
  if (overdue) return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone="info">Unpaid</Badge>;
}

// One line per currency, e.g. "40,600.00 RSD".
export function MoneyList({ totals, field = "total", className, empty = "—" }) {
  if (!totals || totals.length === 0) return <span className="text-faint">{empty}</span>;
  return (
    <span className={cn("num inline-flex flex-col", className)}>
      {totals.map((t) => (
        <span key={t.currency}>{formatMoney(t[field], t.currency)}</span>
      ))}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon ? (
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Callout({ tone = "info", icon: Icon, title, children, action }) {
  const tones = {
    info: "border-line bg-surface",
    accent: "border-accent/25 bg-accent-soft",
    warning: "border-warning/30 bg-warning-soft",
    success: "border-success/30 bg-success-soft",
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3.5", tones[tone])}>
      {Icon ? <Icon className="size-5 shrink-0 text-muted" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        <div className="leading-relaxed text-muted">{children}</div>
      </div>
      {action}
    </div>
  );
}

// Table primitives: a horizontally scrollable table inside a card.
export function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left", className }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-5 py-2.5 text-xs font-medium whitespace-nowrap text-muted",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className }) {
  return (
    <td className={cn("px-5 py-3 align-top", align === "right" && "text-right", className)}>{children}</td>
  );
}

export const rowClass = "border-b border-line last:border-b-0 hover:bg-surface-2/60";
