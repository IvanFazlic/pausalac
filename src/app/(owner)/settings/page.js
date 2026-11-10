import { PartyPopper } from "lucide-react";
import { headers } from "next/headers";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { LoginManager } from "@/components/login-manager";
import { Callout, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import {
  createAuditorAction,
  deleteAuditorAction,
  resetAuditorPasswordAction,
  setAuditorDisabledAction,
} from "@/lib/actions/auditors";
import { changePasswordAction } from "@/lib/actions/auth";
import {
  saveCompanyAction,
  saveSettingsAction,
  setNextNumberAction,
  updateOwnerProfileAction,
} from "@/lib/actions/settings";
import { requireOwner } from "@/lib/auth/session";
import { getCompany, getCompanyVersions, getNumbering, getSettings } from "@/lib/data/company";
import { listAuditors } from "@/lib/data/users";
import { toLoginRow } from "@/lib/login-rows";
import { formatDateTime, todayISO } from "@/lib/dates";
import { CURRENCIES } from "@/lib/money";

export const metadata = { title: "Settings" };

function FormFooter({ label = "Save changes" }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <SubmitButton>{label}</SubmitButton>
      <FormMessage />
    </div>
  );
}

export default async function SettingsPage({ searchParams }) {
  const user = await requireOwner();
  const welcome = (await searchParams).welcome === "1";
  const [company, versions, settings, numbering, auditors, requestHeaders] = await Promise.all([
    getCompany(),
    getCompanyVersions(),
    getSettings(),
    getNumbering(todayISO()),
    listAuditors(),
    headers(),
  ]);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const loginUrl = `${protocol}://${host}/login`;
  const year = numbering.year;
  const lockedInvoices = versions.reduce((sum, version) => sum + version.invoice_count, 0);
  const currencies = CURRENCIES.includes(settings.default_currency)
    ? CURRENCIES
    : [settings.default_currency, ...CURRENCIES];

  return (
    <>
      <PageHeader title="Settings" description="Your company details and the defaults used for new invoices." />

      <div className="max-w-3xl space-y-6">
        {welcome && !company ? (
          <Callout tone="success" icon={PartyPopper} title="Your account is ready">
            Add your company details below. They are printed on every invoice you issue.
          </Callout>
        ) : null}

        <Card id="company">
          <CardHeader
            title="Company details"
            description={
              lockedInvoices > 0
                ? `Printed on invoices. Saving a change starts a new version: future invoices use it, and the ${lockedInvoices} already issued stay exactly as they are.`
                : "Printed on every invoice. You can change them later; invoices already issued keep the details they were issued with."
            }
          />
          <ActionForm action={saveCompanyAction} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" name="name" className="sm:col-span-2" hint="As registered, e.g. “Ime Prezime PR Naziv”.">
                <Input name="name" defaultValue={company?.name ?? ""} maxLength={200} required autoComplete="organization" />
              </Field>
              <Field label="Address" name="address" className="sm:col-span-2">
                <Input name="address" defaultValue={company?.address ?? ""} maxLength={300} autoComplete="street-address" />
              </Field>
              <Field label="PIB" name="pib">
                <Input name="pib" defaultValue={company?.pib ?? ""} maxLength={30} className="num" autoComplete="off" />
              </Field>
              <Field label="MB (matični broj)" name="mb">
                <Input name="mb" defaultValue={company?.mb ?? ""} maxLength={30} className="num" autoComplete="off" />
              </Field>
              <Field label="Phone" name="phone">
                <Input name="phone" defaultValue={company?.phone ?? ""} maxLength={50} autoComplete="tel" />
              </Field>
              <Field label="Email" name="email">
                <Input name="email" type="email" defaultValue={company?.email ?? ""} maxLength={200} autoComplete="off" />
              </Field>
              <Field label="Website" name="website" className="sm:col-span-2">
                <Input name="website" defaultValue={company?.website ?? ""} maxLength={200} autoComplete="url" />
              </Field>
              <Field label="Bank account" name="bank_account" hint="The account clients pay into.">
                <Input name="bank_account" defaultValue={company?.bank_account ?? ""} maxLength={60} className="num" autoComplete="off" />
              </Field>
              <Field label="Bank" name="bank_name">
                <Input name="bank_name" defaultValue={company?.bank_name ?? ""} maxLength={120} autoComplete="off" />
              </Field>
            </div>

            <div className="border-t border-line pt-5">
              <h3 className="text-[13px] font-semibold text-ink">Payments from abroad</h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                Printed on invoices in a foreign currency instead of the dinar account. Copy them from your
                bank&apos;s instructions for incoming payments.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account holder, as the bank writes it" name="foreign_holder" className="sm:col-span-2" hint="Leave empty to use the business name.">
                <Input name="foreign_holder" defaultValue={company?.foreign_holder ?? ""} maxLength={200} autoComplete="off" />
              </Field>
              <Field label="Holder address" name="foreign_holder_address" className="sm:col-span-2">
                <Input name="foreign_holder_address" defaultValue={company?.foreign_holder_address ?? ""} maxLength={300} autoComplete="off" />
              </Field>
              <Field label="IBAN" name="iban">
                <Input name="iban" defaultValue={company?.iban ?? ""} maxLength={60} className="num" autoComplete="off" />
              </Field>
              <Field label="SWIFT / BIC" name="swift">
                <Input name="swift" defaultValue={company?.swift ?? ""} maxLength={20} className="num" autoComplete="off" />
              </Field>
              <Field label="Bank address" name="bank_address" className="sm:col-span-2">
                <Input name="bank_address" defaultValue={company?.bank_address ?? ""} maxLength={200} autoComplete="off" />
              </Field>
              <Field
                label="Correspondent banks"
                name="correspondent_banks"
                className="sm:col-span-2"
                hint="One per line. Start a line with the currency to print it only on invoices in that currency, e.g. “EUR: Raiffeisen Bank International AG, Austria, SWIFT RZBAATWW”."
              >
                <Textarea name="correspondent_banks" defaultValue={company?.correspondent_banks ?? ""} rows={3} maxLength={1000} />
              </Field>
              <Field label="Extra payment instruction" name="payment_note" className="sm:col-span-2" hint="Optional line printed with the international payment details.">
                <Textarea name="payment_note" defaultValue={company?.payment_note ?? ""} rows={2} maxLength={500} />
              </Field>
            </div>
            <FormFooter label="Save company details" />
          </ActionForm>
          {versions.length > 1 ? (
            <div className="border-t border-line px-5 py-4">
              <h3 className="text-[13px] font-medium text-ink">Version history</h3>
              <ul className="mt-2 space-y-1 text-[13px] text-muted">
                {versions.map((version, index) => (
                  <li key={version.id} className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      {index === 0 ? "Current" : `Version ${version.version}`} · {version.name}
                    </span>
                    <span className="num">
                      since {formatDateTime(version.created_at)} · {version.invoice_count}{" "}
                      {version.invoice_count === 1 ? "invoice" : "invoices"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card id="defaults">
          <CardHeader
            title="Invoice defaults"
            description="Pre-filled on each new invoice and used by recurring invoices. You can change any of them on a single invoice."
          />
          <ActionForm action={saveSettingsAction} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default currency" name="default_currency" hint="Clients can have their own, and each invoice line can use any currency.">
                <Select name="default_currency" defaultValue={settings.default_currency}>
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment due after (days)" name="payment_terms_days">
                <Input name="payment_terms_days" inputMode="numeric" defaultValue={settings.payment_terms_days} className="num" />
              </Field>
              <Field label="Place of issue" name="place_of_issue">
                <Input name="place_of_issue" defaultValue={settings.place_of_issue} maxLength={100} />
              </Field>
              <Field label="Payment method (Serbian invoices)" name="payment_method">
                <Input name="payment_method" defaultValue={settings.payment_method} maxLength={100} />
              </Field>
              <Field label="Payment method (English invoices)" name="payment_method_en">
                <Input name="payment_method_en" defaultValue={settings.payment_method_en} maxLength={100} />
              </Field>
              <Field label="Payment purpose" name="payment_purpose" hint="“Svrha uplate” printed under the note.">
                <Input name="payment_purpose" defaultValue={settings.payment_purpose} maxLength={200} />
              </Field>
              <Field label="VAT rate (%)" name="vat_rate" hint="Keep 0 if you are not in the VAT system.">
                <Input name="vat_rate" inputMode="decimal" defaultValue={Number(settings.vat_rate)} className="num" />
              </Field>
              <Field
                label="Invoice number format"
                name="invoice_number_format"
                className="sm:col-span-2"
                hint="Used for clients that do not have their own number format. {seq} is the running number, {seq:4} pads it to 4 digits, {year} or {yy} is the year. Numbering restarts at 1 each year."
              >
                <Input name="invoice_number_format" defaultValue={settings.invoice_number_format} maxLength={40} className="font-mono" />
              </Field>
              <Field label="Default note (Serbian invoices)" name="default_note" className="sm:col-span-2">
                <Textarea name="default_note" defaultValue={settings.default_note} rows={3} maxLength={2000} />
              </Field>
              <Field label="Default note (English invoices)" name="default_note_en" className="sm:col-span-2">
                <Textarea name="default_note_en" defaultValue={settings.default_note_en} rows={3} maxLength={2000} />
              </Field>
            </div>
            <FormFooter label="Save defaults" />
          </ActionForm>
        </Card>

        <Card id="numbering">
          <CardHeader
            title="Numbering"
            description={`General series, for clients without their own number format. The next invoice in ${year} will be ${numbering.preview}. Change the running number to continue from invoices you issued elsewhere.`}
          />
          <ActionForm action={setNextNumberAction} className="space-y-5 p-5">
            <Field
              label={`Next running number in ${year}`}
              name="next_number"
              className="max-w-xs"
              hint="Use 1 to start from the beginning."
            >
              <Input name="next_number" inputMode="numeric" defaultValue={numbering.next_number} className="num" />
            </Field>
            <FormFooter label="Save number" />
          </ActionForm>
        </Card>

        <Card id="access">
          <CardHeader
            title="Read-only access"
            description="For your accountant or the tax office. A read-only login sees every invoice of every client and can download the PDFs. It cannot change anything and sees no settings, clients list or schedules."
          />
          <LoginManager
            users={auditors.map(toLoginRow)}
            loginUrl={loginUrl}
            emptyText="No read-only logins yet."
            actions={{
              create: createAuditorAction,
              reset: resetAuditorPasswordAction,
              setDisabled: setAuditorDisabledAction,
              remove: deleteAuditorAction,
            }}
          />
        </Card>

        <Card id="account">
          <CardHeader title="Your account" description="The main account. It is the only one that can manage clients and invoices." />
          <ActionForm action={updateOwnerProfileAction} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name">
                <Input name="name" defaultValue={user.name} maxLength={120} autoComplete="name" />
              </Field>
              <Field label="Email" name="email" hint="You sign in with this email.">
                <Input name="email" type="email" defaultValue={user.email} maxLength={200} autoComplete="username" />
              </Field>
            </div>
            <FormFooter label="Save account" />
          </ActionForm>
          <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-5 border-t border-line p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current password" name="currentPassword" className="sm:col-span-2 sm:max-w-xs">
                <Input name="currentPassword" type="password" autoComplete="current-password" />
              </Field>
              <Field label="New password" name="newPassword" hint="At least 8 characters.">
                <Input name="newPassword" type="password" autoComplete="new-password" />
              </Field>
              <Field label="Repeat new password" name="confirmPassword">
                <Input name="confirmPassword" type="password" autoComplete="new-password" />
              </Field>
            </div>
            <FormFooter label="Change password" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
