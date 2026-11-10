import { formatDate } from "@/lib/dates";
import {
  buyerRows,
  issuerRows,
  labelsFor,
  paymentLines,
  singleCurrency,
} from "@/lib/invoice-labels";
import { formatAmount, formatQuantity, formatUnitPrice } from "@/lib/money";

function Party({ heading, rows }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-zinc-500">{heading}</h3>
      <dl className="space-y-1 text-[13px] leading-snug">
        {rows.map(([label, value], index) => (
          <div key={label} className="flex gap-2">
            <dt className="w-24 shrink-0 text-zinc-500">{label}:</dt>
            <dd className={index === 0 ? "min-w-0 font-semibold break-words text-zinc-900" : "min-w-0 break-words text-zinc-800"}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The invoice as a sheet of paper. It always renders from the snapshot stored
// on the invoice, so it looks the same no matter what has changed since.
// Colors are fixed (not theme tokens): paper stays white in dark mode.
export function InvoiceView({ invoice }) {
  const lang = invoice.language;
  const t = labelsFor(lang);
  const currency = singleCurrency(invoice);
  const hasUnits = invoice.items.some((item) => item.unit);
  const cancelled = invoice.status === "cancelled";
  const noteLines = [...(invoice.note ? invoice.note.split("\n") : []), ...paymentLines(invoice, t)];

  const meta = [
    [t.issueDate, formatDate(invoice.issue_date, lang)],
    [t.serviceDate, formatDate(invoice.service_date, lang)],
    [t.dueDate, formatDate(invoice.due_date, lang)],
    [t.place, invoice.place_of_issue],
    [t.currency, currency],
    [t.paymentMethod, invoice.payment_method],
  ].filter(([, value]) => value);

  return (
    <article
      lang={lang === "sr" ? "sr-Latn" : "en"}
      className="relative mx-auto w-full max-w-[52rem] overflow-hidden rounded-xl bg-white p-6 text-zinc-900 shadow-paper ring-1 ring-black/5 sm:p-10"
    >
      {cancelled ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <span className="-rotate-[24deg] text-6xl font-bold tracking-widest whitespace-nowrap text-red-600/10 sm:text-8xl">
            {t.cancelled}
          </span>
        </div>
      ) : null}

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{t.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t.number}: <span className="num font-mono font-medium text-zinc-900">{invoice.number}</span>
            </p>
            {cancelled ? <p className="mt-2 text-sm font-semibold text-red-700">{t.cancelled}</p> : null}
          </div>
          <dl className="num space-y-1 text-[13px]">
            {meta.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-6">
                <dt className="text-zinc-500">{label}:</dt>
                <dd className="text-right font-medium text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 grid gap-8 border-y border-zinc-200 py-6 sm:grid-cols-2">
          <Party heading={t.issuer} rows={issuerRows(invoice, t)} />
          <Party heading={t.buyer} rows={buyerRows(invoice.client_snapshot, t)} />
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">{t.description}</th>
                {hasUnits ? <th scope="col" className="px-3 py-2 font-semibold">{t.unit}</th> : null}
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.quantity}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.unitPrice}</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">{t.amount}</th>
              </tr>
            </thead>
            <tbody className="num">
              {invoice.items.map((item) => (
                <tr key={item.position} className="border-b border-zinc-100 align-top">
                  <td className="py-2.5 pr-3 break-words whitespace-pre-line text-zinc-900">{item.description}</td>
                  {hasUnits ? <td className="px-3 py-2.5 text-zinc-600">{item.unit}</td> : null}
                  <td className="px-3 py-2.5 text-right text-zinc-700">{formatQuantity(item.quantity, lang)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-zinc-700">
                    {formatUnitPrice(item.unit_price, lang)}
                    {currency ? null : <span className="text-zinc-500"> {item.currency}</span>}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-medium whitespace-nowrap text-zinc-900">
                    {formatAmount(item.amount, lang)}
                    {currency ? null : <span className="font-normal text-zinc-500"> {item.currency}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col items-end gap-5">
          {invoice.totals.map((total) => (
            <dl key={total.currency} className="num w-full max-w-xs space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-500">{t.subtotal}</dt>
                <dd>{formatAmount(total.subtotal, lang)} {total.currency}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-zinc-500">
                  {t.vat} ({formatQuantity(invoice.vat_rate, lang)}%)
                </dt>
                <dd>{formatAmount(total.vat, lang)} {total.currency}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-zinc-300 pt-2 text-base font-semibold">
                <dt>{t.totalDue}</dt>
                <dd className="whitespace-nowrap">{formatAmount(total.total, lang)} {total.currency}</dd>
              </div>
            </dl>
          ))}
        </div>

        <div className="mt-10 border-t border-zinc-200 pt-5 text-[13px] leading-relaxed text-zinc-700">
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-zinc-500 uppercase">{t.note}</h3>
          {noteLines.map((line, index) => (
            <p key={index} className="break-words">{line || " "}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
