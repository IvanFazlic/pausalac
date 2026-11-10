"use client";

import { Plus, Trash2 } from "lucide-react";
import { CURRENCIES, computeTotals, formatAmount, formatMoney, lineAmountCents } from "@/lib/money";
import { buttonClass, cn, inputClass } from "./classes";

let keyCounter = 0;

export function newItem(currency, values = {}) {
  keyCounter += 1;
  return {
    key: `item-${keyCounter}`,
    description: "",
    unit: "",
    quantity: "1",
    unit_price: "",
    currency,
    ...values,
  };
}

// Strips the React key before the items are sent to the server.
export function itemsPayload(items) {
  return items.map(({ description, unit, quantity, unit_price, currency }) => ({
    description,
    unit,
    quantity,
    unit_price,
    currency,
  }));
}

function Cell({ label, className, children }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

// Line items with a currency per line. Each item is two rows (description,
// then the numbers) so long descriptions have room at every screen width.
// Totals are shown per currency, with the same rounding the database uses.
export function ItemsEditor({ items, onChange, defaultCurrency, vatRate = "0", errors = {} }) {
  const totals = computeTotals(items, vatRate);
  const showVat = Number(String(vatRate).replace(",", ".")) > 0;
  const itemErrors = [
    ...new Set(
      Object.entries(errors)
        .filter(([key]) => key === "items" || key.startsWith("items."))
        .map(([key, message]) => {
          const row = key.split(".")[1];
          return row === undefined ? message : `Item ${Number(row) + 1}: ${message}`;
        })
    ),
  ];

  const update = (key, patch) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const remove = (key) => onChange(items.filter((item) => item.key !== key));
  const add = () => onChange([...items, newItem(items.at(-1)?.currency ?? defaultCurrency)]);
  const invalid = (index, field) => (errors[`items.${index}.${field}`] ? true : undefined);

  return (
    <div>
      <ol className="divide-y divide-line border-y border-line">
        {items.map((item, index) => {
          const cents = lineAmountCents(item.quantity, item.unit_price);
          const n = index + 1;
          const currencies = CURRENCIES.includes(item.currency) ? CURRENCIES : [item.currency, ...CURRENCIES];
          return (
            <li key={item.key} className="py-4">
              <div className="flex items-end gap-2">
                <Cell label={`Item ${n}`} className="flex-1">
                  <input
                    className={inputClass}
                    value={item.description}
                    onChange={(e) => update(item.key, { description: e.target.value })}
                    placeholder="Description of the work or service"
                    aria-label={`Item ${n} description`}
                    aria-invalid={invalid(index, "description")}
                    maxLength={500}
                  />
                </Cell>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  disabled={items.length === 1}
                  className={buttonClass({ variant: "ghost", className: "w-9 px-0" })}
                  aria-label={`Remove item ${n}`}
                  title="Remove item"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 pr-11 sm:grid-cols-[4.5rem_6rem_minmax(0,9rem)_5.5rem_minmax(0,1fr)]">
                <Cell label="Unit">
                  <input
                    className={inputClass}
                    value={item.unit}
                    onChange={(e) => update(item.key, { unit: e.target.value })}
                    placeholder="h"
                    aria-label={`Item ${n} unit`}
                    aria-invalid={invalid(index, "unit")}
                    maxLength={20}
                  />
                </Cell>
                <Cell label="Quantity">
                  <input
                    className={cn(inputClass, "num text-right")}
                    value={item.quantity}
                    onChange={(e) => update(item.key, { quantity: e.target.value })}
                    inputMode="decimal"
                    aria-label={`Item ${n} quantity`}
                    aria-invalid={invalid(index, "quantity")}
                  />
                </Cell>
                <Cell label="Unit price">
                  <input
                    className={cn(inputClass, "num text-right")}
                    value={item.unit_price}
                    onChange={(e) => update(item.key, { unit_price: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Item ${n} unit price`}
                    aria-invalid={invalid(index, "unit_price")}
                  />
                </Cell>
                <Cell label="Currency">
                  <select
                    className={cn(inputClass, "px-2")}
                    value={item.currency}
                    onChange={(e) => update(item.key, { currency: e.target.value })}
                    aria-label={`Item ${n} currency`}
                  >
                    {currencies.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </Cell>
                <div className="col-span-2 flex items-baseline justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:gap-0">
                  <span className="text-[11px] font-medium text-muted sm:mb-1">Amount</span>
                  <span className="num text-sm font-medium text-ink sm:flex sm:h-9 sm:items-center">
                    {cents === null ? (
                      <span className="text-faint">—</span>
                    ) : (
                      formatMoney(Number(cents) / 100, item.currency)
                    )}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {itemErrors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-danger" role="alert">
          {itemErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 pt-4">
        <button type="button" onClick={add} className={buttonClass({ variant: "secondary", size: "sm" })}>
          <Plus aria-hidden="true" />
          Add item
        </button>

        <div className="num ml-auto min-w-56 space-y-3 pr-11 text-sm">
          {totals.length === 0 ? (
            <p className="text-right text-muted">Add a price to see the total.</p>
          ) : (
            totals.map((total) => (
              <dl key={total.currency} className="space-y-1">
                {showVat ? (
                  <>
                    <div className="flex justify-between gap-6 text-muted">
                      <dt>Subtotal</dt>
                      <dd>{formatAmount(total.subtotal)} {total.currency}</dd>
                    </div>
                    <div className="flex justify-between gap-6 text-muted">
                      <dt>VAT</dt>
                      <dd>{formatAmount(total.vat)} {total.currency}</dd>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between gap-6 text-base font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>{formatMoney(total.total, total.currency)}</dd>
                </div>
              </dl>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
