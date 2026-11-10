"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle, Lock } from "lucide-react";
import { createInvoiceAction } from "@/lib/actions/invoices";
import { addDays, isISODate } from "@/lib/dates";
import { formatInvoiceNumber, usesRunningNumber } from "@/lib/numbering";
import { buttonClass, cn, inputClass, textareaClass } from "./classes";
import { Notice } from "./form";
import { ItemsEditor, itemsPayload, newItem } from "./items-editor";
import { Field } from "./ui";
import { useFormResult } from "./use-form-result";

const cardClass = "rounded-xl border border-line bg-surface shadow-card";

export function InvoiceForm({ clients, defaults, today, initialClientId, numbering }) {
  const findClient = (id) => clients.find((client) => client.id === id) ?? null;
  const termsFor = (client) => client?.payment_terms_days ?? defaults.payment_terms_days;
  const currencyFor = (client) => client?.default_currency ?? defaults.default_currency;
  // English invoices get the English default note and payment method.
  const noteFor = (client) =>
    client?.invoice_language === "en" ? defaults.default_note_en : defaults.default_note;
  const methodFor = (client) =>
    client?.invoice_language === "en" ? defaults.payment_method_en : defaults.payment_method;
  const initialClient = findClient(initialClientId);

  const [clientId, setClientId] = useState(initialClient?.id ?? "");
  const [issueDate, setIssueDate] = useState(today);
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceTouched, setServiceTouched] = useState(false);
  const [dueDate, setDueDate] = useState(addDays(today, termsFor(initialClient)));
  const [dueTouched, setDueTouched] = useState(false);
  const [placeOfIssue, setPlaceOfIssue] = useState(defaults.place_of_issue);
  const [paymentMethod, setPaymentMethod] = useState(methodFor(initialClient));
  const [methodTouched, setMethodTouched] = useState(false);
  const [paymentPurpose, setPaymentPurpose] = useState(defaults.payment_purpose);
  const [vatRate, setVatRate] = useState(String(Number(defaults.vat_rate)));
  const [note, setNote] = useState(noteFor(initialClient));
  const [noteTouched, setNoteTouched] = useState(false);
  const [items, setItems] = useState(() => [newItem(currencyFor(initialClient))]);
  const { result, setResult, clearErrors, errors } = useFormResult();
  const [pending, startTransition] = useTransition();

  const client = findClient(clientId);
  const invalid = (name) => (errors[name] ? true : undefined);

  // Preview only; the database assigns the real number when the invoice is issued.
  const numberFormat = client?.number_format || numbering.format;
  const nextSeq = client?.number_format ? client.next_seq : numbering.next_number;
  const numberPreview = isISODate(issueDate)
    ? formatInvoiceNumber(numberFormat, usesRunningNumber(numberFormat) ? nextSeq : null, issueDate)
    : "…";

  function onClientChange(id) {
    const next = findClient(id);
    const previousCurrency = currencyFor(client);
    const nextCurrency = currencyFor(next);
    setClientId(id);
    clearErrors("clientId");
    // Lines still on the previous client's currency follow the new client.
    setItems((current) =>
      current.map((item) => (item.currency === previousCurrency ? { ...item, currency: nextCurrency } : item))
    );
    if (!dueTouched && isISODate(issueDate)) setDueDate(addDays(issueDate, termsFor(next)));
    if (!noteTouched) setNote(noteFor(next));
    if (!methodTouched) setPaymentMethod(methodFor(next));
  }

  function onIssueDateChange(value) {
    setIssueDate(value);
    clearErrors("issueDate");
    if (!isISODate(value)) return;
    if (!serviceTouched) setServiceDate(value);
    if (!dueTouched) {
      setDueDate(addDays(value, termsFor(client)));
      clearErrors("dueDate");
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    startTransition(async () => {
      const outcome = await createInvoiceAction({
        clientId,
        issueDate,
        serviceDate,
        dueDate,
        placeOfIssue,
        paymentMethod,
        paymentPurpose,
        vatRate,
        note,
        items: itemsPayload(items),
      });
      setResult(outcome ?? null);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"
    >
      <div className="space-y-6">
        <section className={cn(cardClass, "p-5")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Client"
              name="clientId"
              error={errors.clientId ? "Choose a client." : undefined}
              className="sm:col-span-3"
            >
              <select
                id="clientId"
                className={inputClass}
                value={clientId}
                onChange={(e) => onClientChange(e.target.value)}
                aria-invalid={invalid("clientId")}
              >
                <option value="">Choose a client…</option>
                {clients.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date" name="issueDate" error={errors.issueDate}>
              <input
                id="issueDate"
                type="date"
                className={inputClass}
                value={issueDate}
                onChange={(e) => onIssueDateChange(e.target.value)}
                aria-invalid={invalid("issueDate")}
              />
            </Field>
            <Field label="Date of supply" name="serviceDate" error={errors.serviceDate}>
              <input
                id="serviceDate"
                type="date"
                className={inputClass}
                value={serviceDate}
                onChange={(e) => {
                  setServiceTouched(true);
                  setServiceDate(e.target.value);
                  clearErrors("serviceDate");
                }}
                aria-invalid={invalid("serviceDate")}
              />
            </Field>
            <Field label="Due date" name="dueDate" error={errors.dueDate}>
              <input
                id="dueDate"
                type="date"
                className={inputClass}
                value={dueDate}
                min={issueDate}
                onChange={(e) => {
                  setDueTouched(true);
                  setDueDate(e.target.value);
                  clearErrors("dueDate");
                }}
                aria-invalid={invalid("dueDate")}
              />
            </Field>
          </div>
        </section>

        <section className={cn(cardClass, "p-5")}>
          <h2 className="mb-4 text-[15px] font-semibold text-ink">Items</h2>
          <ItemsEditor
            items={items}
            onChange={(next) => {
              setItems(next);
              clearErrors("items");
            }}
            defaultCurrency={currencyFor(client)}
            vatRate={vatRate}
            errors={errors}
          />
        </section>

        <section className={cn(cardClass, "p-5")}>
          <h2 className="mb-4 text-[15px] font-semibold text-ink">Payment and notes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment purpose" name="paymentPurpose" error={errors.paymentPurpose}>
              <input
                id="paymentPurpose"
                className={inputClass}
                value={paymentPurpose}
                onChange={(e) => setPaymentPurpose(e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Payment method" name="paymentMethod" error={errors.paymentMethod}>
              <input
                id="paymentMethod"
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => {
                  setMethodTouched(true);
                  setPaymentMethod(e.target.value);
                }}
                maxLength={100}
              />
            </Field>
            <Field label="Place of issue" name="placeOfIssue" error={errors.placeOfIssue}>
              <input
                id="placeOfIssue"
                className={inputClass}
                value={placeOfIssue}
                onChange={(e) => setPlaceOfIssue(e.target.value)}
                maxLength={100}
              />
            </Field>
            <Field
              label="VAT rate (%)"
              name="vatRate"
              error={errors.vatRate}
              hint="Keep 0 if you are not in the VAT system."
            >
              <input
                id="vatRate"
                className={cn(inputClass, "num")}
                value={vatRate}
                onChange={(e) => {
                  setVatRate(e.target.value);
                  clearErrors("vatRate");
                }}
                inputMode="decimal"
                aria-invalid={invalid("vatRate")}
              />
            </Field>
            <Field
              label="Note on the invoice"
              name="note"
              error={errors.note}
              className="sm:col-span-2"
              hint="The bank account and payment reference are added below the note automatically."
            >
              <textarea
                id="note"
                className={textareaClass}
                value={note}
                onChange={(e) => {
                  setNoteTouched(true);
                  setNote(e.target.value);
                }}
                rows={4}
                maxLength={2000}
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className={cn(cardClass, "space-y-4 p-5 lg:sticky lg:top-10")}>
        <div>
          <p className="text-xs font-medium text-muted">Invoice number</p>
          <p className="num mt-1 font-mono text-lg font-semibold text-ink">{numberPreview}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {client?.number_format ? "From this client’s own series. " : ""}Assigned when you issue the invoice.
          </p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-xs font-medium text-muted">Invoice language</p>
          <p className="mt-1 text-sm text-ink">
            {client ? (client.invoice_language === "en" ? "English" : "Serbian") : "Set by the client"}
          </p>
        </div>
        <p className="flex gap-2 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Issuing stores your company details and the client&apos;s details with the invoice. After that the
          invoice cannot be edited, only marked as paid or cancelled.
        </p>
        {result?.error ? <Notice>{result.error}</Notice> : null}
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Issuing…" : "Issue invoice"}
          </button>
          <Link href="/invoices" className={buttonClass({ variant: "ghost" })}>
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
