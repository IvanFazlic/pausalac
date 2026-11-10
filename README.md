# Paušalac

Invoicing for a paušalac (flat-rate entrepreneur): clients, invoices, recurring
invoices, PDF download, and a portal where each client sees only their own
invoices.

Next.js 16 (App Router) · Neon Postgres · Tailwind CSS 4.

## Getting started

```bash
vercel env pull .env.local   # DATABASE_URL etc. from the linked Vercel project
npm install
npm run db:migrate           # creates the tables (safe to run again)
npm run dev
```

Open http://localhost:3000. On first run you are asked to create the **main
account**. After that the setup page is closed for good. Then fill in your
company details in **Settings** and add a client.

Local development and the deployed site use the same Neon database, so the
account you create locally is the one you sign in with in production. Create it
before the first deploy, so nobody else can claim the setup page.

## How it works

**Three kinds of login.** The main account manages everything. It creates logins
for clients (Clients → a client → Portal access); a temporary password is shown
once and the client must choose their own on first sign-in. A client login can
only list, open and download invoices issued to that client. A read-only login
(Settings → Read-only access), meant for an accountant or the tax office, sees
every invoice and its PDF but cannot change anything. Every page, server action
and the PDF endpoint checks this on the server.

**Invoices are frozen when issued.** Issuing stores a snapshot of your company
details and the client's details on the invoice. Changing company data in
Settings creates a new version that only future invoices use. The database
itself rejects any later change to an invoice or its items (triggers in
`db/migrations/001_init.sql`); only the status can change: unpaid → paid, or
unpaid → cancelled. Invoices are never deleted, so numbering has no gaps.

**Numbering.** A client can have its own number series (the "Invoice number
format" on the client), for example `3{seq:4}/{year}` for 30001/2026 or
`{mm}/{year}` for month-based numbers like 04/2026. Clients without one share
the general series from Settings. Placeholders: `{seq}`, `{seq:4}`, `{mm}`,
`{year}`, `{yy}`. Running numbers restart each year; set the next running
number to continue a sequence you started elsewhere.

**Currencies.** Each client has a default currency and each invoice line has
its own. An invoice with lines in several currencies shows a total per currency.
Unit prices keep up to four decimals (hourly rates such as 11.375).

**Payments from abroad.** Invoices in a foreign currency print the beneficiary,
IBAN, SWIFT and correspondent bank from Settings instead of the dinar account.
English invoices use their own default note and payment method wording.

**Recurring invoices.** A schedule issues an invoice every week or month, using
the company details as they are on that day. Vercel Cron calls
`/api/cron/recurring` once a day (`vercel.json`); the "Issue due invoices now"
button does the same on demand. Running it twice never issues an occurrence
twice.

**PDF.** `/api/invoices/:id/pdf` renders the invoice from its stored snapshot,
in the client's invoice language (Serbian or English). `@react-pdf/renderer`
is pinned to an exact version; see the note above `renderInvoicePdf` in
`src/lib/pdf/invoice-document.js` before upgrading it.

## Environment variables

| Name | Used for |
| --- | --- |
| `DATABASE_URL` | All queries (pooled Neon connection). Set by the Vercel Neon integration. |
| `DATABASE_URL_UNPOOLED` | `npm run db:migrate`. Set by the integration. |
| `CRON_SECRET` | Lets Vercel Cron call `/api/cron/recurring`. Any long random string. Without it scheduled invoices are only issued with the button. |

## Deploying

The Vercel project deploys from `main`. Functions run in `fra1`, next to the
database. After adding a migration file, run `npm run db:migrate` before
deploying code that needs it.

## Layout

```
db/migrations/        SQL schema, applied by scripts/migrate.mjs
src/app/(owner)/      main-account pages: dashboard, invoices, recurring, clients, settings
src/app/portal/       client portal
src/app/api/          PDF download and the cron endpoint
src/lib/data/         all SQL lives here
src/lib/actions/      server actions (validate, check access, call lib/data)
src/lib/auth/         password hashing and sessions
src/lib/pdf/          the PDF invoice
src/components/       UI
```
