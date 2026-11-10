"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, LoaderCircle } from "lucide-react";
import { createScheduleAction, updateScheduleAction } from "@/lib/actions/recurring";
import { formatDate, isISODate, occurrenceDate } from "@/lib/dates";
import { buttonClass, cn, inputClass, labelClass, textareaClass } from "./classes";
import { Notice } from "./form";
import { ItemsEditor, itemsPayload, newItem } from "./items-editor";
import { Field } from "./ui";
import { useFormResult } from "./use-form-result";

const cardClass = "rounded-xl border border-line bg-surface shadow-card";

// The next few dates this schedule will issue on, for the preview panel.
function upcomingDates(schedule, nextDate, frequency, endDate) {
  if (!isISODate(nextDate)) return [];
  // Unchanged schedules keep their original anchor (so "31st" stays the 31st).
  const unchanged = schedule && schedule.next_run_date === nextDate && schedule.frequency === frequency;
  const anchor = unchanged ? schedule.anchor_date : nextDate;
  const offset = unchanged ? schedule.runs_count : 0;
  const dates = [];
  for (let i = 0; i < 4; i += 1) {
    const date = occurrenceDate(anchor, frequency, offset + i);
    if (endDate && isISODate(endDate) && date > endDate) break;
    dates.push(date);
  }
  return dates;
}

export function RecurringForm({ clients, defaults, today, schedule = null }) {
  const findClient = (id) => clients.find((client) => client.id === id) ?? null;
  const currencyFor = (client) => client?.default_currency ?? defaults.default_currency;

  const [clientId, setClientId] = useState(schedule?.client_id ?? "");
  const [name, setName] = useState(schedule?.name ?? "");
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "monthly");
  const [nextDate, setNextDate] = useState(schedule?.next_run_date ?? today);
  const [endDate, setEndDate] = useState(schedule?.end_date ?? "");
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    String(schedule?.payment_terms_days ?? defaults.payment_terms_days)
  );
  const [paymentPurpose, setPaymentPurpose] = useState(schedule?.payment_purpose ?? defaults.payment_purpose);
  const [note, setNote] = useState(schedule?.note ?? defaults.default_note);
  const [items, setItems] = useState(() =>
    schedule ? schedule.items.map((item) => newItem(item.currency, item)) : [newItem(defaults.default_currency)]
  );
  const { result, setResult, clearErrors, errors } = useFormResult();
  const [pending, startTransition] = useTransition();

  const client = findClient(clientId);
  const preview = upcomingDates(schedule, nextDate, frequency, endDate);
  const invalid = (field) => (errors[field] ? true : undefined);

  function onClientChange(id) {
    const next = findClient(id);
    const previousCurrency = currencyFor(client);
    const nextCurrency = currencyFor(next);
    setClientId(id);
    clearErrors("clientId");
    setItems((current) =>
      current.map((item) => (item.currency === previousCurrency ? { ...item, currency: nextCurrency } : item))
    );
    if (!schedule && next?.payment_terms_days != null) setPaymentTermsDays(String(next.payment_terms_days));
  }

  function onSubmit(event) {
    event.preventDefault();
    const payload = {
      clientId,
      name,
      frequency,
      nextDate,
      endDate,
      paymentTermsDays,
      paymentPurpose,
      note,
      items: itemsPayload(items),
    };
    startTransition(async () => {
      const outcome = schedule
        ? await updateScheduleAction(schedule.id, payload)
        : await createScheduleAction(payload);
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" name="clientId" error={errors.clientId ? "Choose a client." : undefined}>
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
            <Field label="Name" name="name" error={errors.name} hint="Only you see this, e.g. “Monthly retainer”.">
              <input
                id="name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </Field>

            <fieldset className="sm:col-span-2">
              <legend className={labelClass}>Repeats</legend>
              <div className="mt-1.5 inline-flex rounded-lg border border-line-strong bg-surface-2 p-0.5">
                {[
                  ["weekly", "Every week"],
                  ["monthly", "Every month"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={cn(
                      "cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent",
                      frequency === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                    )}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={value}
                      checked={frequency === value}
                      onChange={() => setFrequency(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label={schedule ? "Next invoice date" : "First invoice date"} name="nextDate" error={errors.nextDate}>
              <input
                id="nextDate"
                type="date"
                className={inputClass}
                value={nextDate}
                min={today}
                onChange={(e) => {
                  setNextDate(e.target.value);
                  clearErrors("nextDate");
                }}
                aria-invalid={invalid("nextDate")}
              />
            </Field>
            <Field
              label="End date (optional)"
              name="endDate"
              error={errors.endDate}
              hint="No invoices are issued after this date."
            >
              <input
                id="endDate"
                type="date"
                className={inputClass}
                value={endDate}
                min={nextDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  clearErrors("endDate");
                }}
                aria-invalid={invalid("endDate")}
              />
            </Field>
          </div>
        </section>

        <section className={cn(cardClass, "p-5")}>
          <h2 className="mb-4 text-[15px] font-semibold text-ink">Items on each invoice</h2>
          <ItemsEditor
            items={items}
            onChange={(next) => {
              setItems(next);
              clearErrors("items");
            }}
            defaultCurrency={currencyFor(client)}
            errors={errors}
          />
        </section>

        <section className={cn(cardClass, "p-5")}>
          <h2 className="mb-4 text-[15px] font-semibold text-ink">Payment and notes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment due after (days)" name="paymentTermsDays" error={errors.paymentTermsDays}>
              <input
                id="paymentTermsDays"
                className={cn(inputClass, "num")}
                value={paymentTermsDays}
                onChange={(e) => {
                  setPaymentTermsDays(e.target.value);
                  clearErrors("paymentTermsDays");
                }}
                inputMode="numeric"
                aria-invalid={invalid("paymentTermsDays")}
              />
            </Field>
            <Field label="Payment purpose" name="paymentPurpose" error={errors.paymentPurpose}>
              <input
                id="paymentPurpose"
                className={inputClass}
                value={paymentPurpose}
                onChange={(e) => setPaymentPurpose(e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Note on the invoice" name="note" error={errors.note} className="sm:col-span-2">
              <textarea
                id="note"
                className={textareaClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className={cn(cardClass, "space-y-4 p-5 lg:sticky lg:top-10")}>
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-muted">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Upcoming invoices
          </p>
          {preview.length > 0 ? (
            <ol className="num mt-2 space-y-1 text-sm text-ink">
              {preview.map((date) => (
                <li key={date}>{formatDate(date)}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">Choose a date to see the schedule.</p>
          )}
        </div>
        <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Each invoice is issued automatically on its date, with your company details as they are on that day.
          The due date is the issue date plus the payment terms.
        </p>
        {result?.error ? <Notice>{result.error}</Notice> : null}
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={pending} className={buttonClass({ size: "lg" })}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "Saving…" : schedule ? "Save schedule" : "Create schedule"}
          </button>
          <Link href="/recurring" className={buttonClass({ variant: "ghost" })}>
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
