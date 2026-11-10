import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { buttonClass, cn } from "./classes";
import { NavLinks } from "./nav-links";

export function Brand({ href = "/", className }) {
  return (
    <Link href={href} className={cn("flex w-fit items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink shadow-card">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden="true">
          <path
            d="M7 3.75h7.1L18.25 8v11.5a.75.75 0 0 1-.75.75H7a.75.75 0 0 1-.75-.75v-15A.75.75 0 0 1 7 3.75Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.5 12h5M9.5 15.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Paušalac</span>
    </Link>
  );
}

function SignOutButton({ compact = false }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={buttonClass({ variant: "ghost", size: "sm", className: compact ? "px-2" : "" })}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut aria-hidden="true" />
        {compact ? null : "Sign out"}
      </button>
    </form>
  );
}

// Layout for the main account: sidebar on desktop, top bar on small screens.
export function AppShell({ user, children }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand href="/dashboard" />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-line p-3 pl-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{user.name || "Main account"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <SignOutButton compact />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Brand href="/dashboard" />
            <SignOutButton compact />
          </div>
          <nav aria-label="Main" className="overflow-x-auto px-3 pb-2">
            <NavLinks horizontal />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

// Layout for client logins: deliberately minimal, only their invoices.
export function PortalShell({ clientName, user, children }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href="/portal" />
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href="/portal/account"
              className="hidden min-w-0 truncate px-2 text-[13px] text-muted hover:text-ink sm:block"
              title="Account"
            >
              {clientName} · {user.email}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

// Centered card for sign-in and first-run setup.
export function AuthShell({ title, description, children, footer }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Brand className="mb-8" />
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-muted">{footer}</p> : null}
    </div>
  );
}
