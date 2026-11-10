import { CURRENCIES } from "@/lib/money";
import { Field, Input, Select, Textarea } from "./ui";

// Fields shared by "New client" and the client's details form.
export function ClientFields({ client = null, defaultCurrency = "RSD", defaultTerms }) {
  const currency = client?.default_currency ?? defaultCurrency;
  const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" name="name" className="sm:col-span-2">
        <Input name="name" defaultValue={client?.name ?? ""} maxLength={200} required autoComplete="off" />
      </Field>
      <Field label="Address" name="address" className="sm:col-span-2">
        <Input name="address" defaultValue={client?.address ?? ""} maxLength={300} autoComplete="off" />
      </Field>
      <Field label="PIB / Tax ID" name="pib">
        <Input name="pib" defaultValue={client?.pib ?? ""} maxLength={30} autoComplete="off" />
      </Field>
      <Field label="MB / Registration number" name="mb">
        <Input name="mb" defaultValue={client?.mb ?? ""} maxLength={30} autoComplete="off" />
      </Field>
      <Field label="Contact person" name="contact_name">
        <Input name="contact_name" defaultValue={client?.contact_name ?? ""} maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Email" name="email">
        <Input name="email" type="email" defaultValue={client?.email ?? ""} maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Phone" name="phone">
        <Input name="phone" defaultValue={client?.phone ?? ""} maxLength={50} autoComplete="off" />
      </Field>
      <Field label="Default currency" name="default_currency" hint="Used for new invoice lines; each line can still use another currency.">
        <Select name="default_currency" defaultValue={currency}>
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Invoice language" name="invoice_language">
        <Select name="invoice_language" defaultValue={client?.invoice_language ?? "sr"}>
          <option value="sr">Serbian</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field
        label="Payment due after (days)"
        name="payment_terms_days"
        hint={`Leave empty to use your default${defaultTerms != null ? ` (${defaultTerms} days)` : ""}.`}
      >
        <Input
          name="payment_terms_days"
          inputMode="numeric"
          defaultValue={client?.payment_terms_days ?? ""}
          className="num"
          autoComplete="off"
        />
      </Field>
      <Field label="Private notes" name="internal_notes" className="sm:col-span-2" hint="Only you see these. They never appear on invoices or in the client portal.">
        <Textarea name="internal_notes" defaultValue={client?.internal_notes ?? ""} rows={3} maxLength={2000} />
      </Field>
    </div>
  );
}
