// Shared class names. Plain strings so both server and client components can use them.

export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium " +
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-ink shadow-card hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-card hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-line-strong bg-surface text-danger shadow-card hover:bg-danger-soft",
};

const BUTTON_SIZES = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

export function buttonClass({ variant = "primary", size = "md", className } = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export const inputClass =
  "block h-9 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors " +
  "focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/25 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted " +
  "aria-invalid:border-danger aria-invalid:focus:outline-danger/25";

export const textareaClass = cn(inputClass, "h-auto min-h-24 py-2 leading-relaxed");

export const labelClass = "block text-[13px] font-medium text-ink";
