import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate } from "@/lib/dates";
import {
  buyerRows,
  issuerRows,
  labelsFor,
  paymentLines,
  singleCurrency,
} from "@/lib/invoice-labels";
import { formatAmount, formatQuantity } from "@/lib/money";

// Inter is bundled because the built-in PDF fonts lack č, ć, đ, š, ž.
// next.config.mjs makes sure these files ship with the PDF route on Vercel.
const fontDir = path.join(process.cwd(), "src", "assets", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});
// Never break words with hyphens (names, account numbers, Serbian text).
Font.registerHyphenationCallback((word) => [word]);

const INK = "#18181b";
const MUTED = "#6b6b70";
const LINE = "#dcdcd6";
const SOFT = "#f4f4f1";

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9.5,
    color: INK,
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    lineHeight: 1.4,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 26, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.1 },
  number: { marginTop: 6, fontSize: 10.5, color: MUTED },
  numberValue: { color: INK, fontWeight: 600 },
  cancelledTag: { marginTop: 6, fontSize: 10, fontWeight: 700, color: "#b91c1c" },
  meta: { width: 210 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  metaLabel: { color: MUTED },
  metaValue: { fontWeight: 600, textAlign: "right", maxWidth: 120 },
  parties: {
    flexDirection: "row",
    marginTop: 26,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
  },
  party: { flex: 1, paddingRight: 16 },
  heading: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, color: MUTED, marginBottom: 6 },
  partyRow: { flexDirection: "row", marginBottom: 2.5 },
  partyLabel: { width: 72, color: MUTED },
  partyValue: { flex: 1 },
  partyName: { flex: 1, fontWeight: 600 },
  table: { marginTop: 26 },
  th: {
    flexDirection: "row",
    backgroundColor: SOFT,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: MUTED,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.75,
    borderColor: "#ecece7",
  },
  cDescription: { flex: 1, paddingRight: 8 },
  cUnit: { width: 46 },
  cQuantity: { width: 54, textAlign: "right" },
  cPrice: { width: 92, textAlign: "right" },
  cAmount: { width: 100, textAlign: "right" },
  amountStrong: { fontWeight: 600 },
  totals: { marginTop: 14, alignItems: "flex-end" },
  totalBlock: { width: 250, marginBottom: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { color: MUTED },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingTop: 7,
    borderTopWidth: 1,
    borderColor: INK,
    fontSize: 12,
    fontWeight: 700,
  },
  notes: { marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderColor: LINE },
  noteLine: { marginBottom: 2.5 },
  footer: {
    position: "absolute",
    left: 44,
    right: 44,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 76,
    fontWeight: 700,
    letterSpacing: 6,
    color: "#b91c1c",
    opacity: 0.1,
    transform: "rotate(-24deg)",
  },
});

function Party({ heading, rows }) {
  return (
    <View style={s.party}>
      <Text style={s.heading}>{heading}</Text>
      {rows.map(([label, value], index) => (
        <View key={label} style={s.partyRow}>
          <Text style={s.partyLabel}>{label}:</Text>
          <Text style={index === 0 ? s.partyName : s.partyValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

// Rendered from the snapshot stored on the invoice, never from current data,
// so a PDF downloaded years later is identical to the one issued.
export function InvoiceDocument({ invoice }) {
  const lang = invoice.language;
  const t = labelsFor(lang);
  const currency = singleCurrency(invoice);
  const hasUnits = invoice.items.some((item) => item.unit);
  const cancelled = invoice.status === "cancelled";
  const withCurrency = (amount, code) => (currency ? amount : `${amount} ${code}`);
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
    <Document
      title={`${t.title} ${invoice.number}`}
      author={invoice.issuer.name}
      subject={`${t.title} ${invoice.number}`}
      language={lang === "sr" ? "sr-Latn" : "en"}
    >
      <Page size="A4" style={s.page}>
        {cancelled ? (
          <Text style={s.watermark} fixed>
            {t.cancelled}
          </Text>
        ) : null}

        <View style={s.header}>
          <View>
            <Text style={s.title}>{t.title}</Text>
            <Text style={s.number}>
              {t.number}: <Text style={s.numberValue}>{invoice.number}</Text>
            </Text>
            {cancelled ? <Text style={s.cancelledTag}>{t.cancelled}</Text> : null}
          </View>
          <View style={s.meta}>
            {meta.map(([label, value]) => (
              <View key={label} style={s.metaRow}>
                <Text style={s.metaLabel}>{label}:</Text>
                <Text style={s.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.parties}>
          <Party heading={t.issuer} rows={issuerRows(invoice.issuer, t)} />
          <Party heading={t.buyer} rows={buyerRows(invoice.client_snapshot, t)} />
        </View>

        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={s.cDescription}>{t.description}</Text>
            {hasUnits ? <Text style={s.cUnit}>{t.unit}</Text> : null}
            <Text style={s.cQuantity}>{t.quantity}</Text>
            <Text style={s.cPrice}>{t.unitPrice}</Text>
            <Text style={s.cAmount}>{t.amount}</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.position} style={s.tr} wrap={false}>
              <Text style={s.cDescription}>{item.description}</Text>
              {hasUnits ? <Text style={s.cUnit}>{item.unit}</Text> : null}
              <Text style={s.cQuantity}>{formatQuantity(item.quantity, lang)}</Text>
              <Text style={s.cPrice}>{withCurrency(formatAmount(item.unit_price, lang), item.currency)}</Text>
              <Text style={[s.cAmount, s.amountStrong]}>
                {withCurrency(formatAmount(item.amount, lang), item.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          {invoice.totals.map((total) => (
            <View key={total.currency} style={s.totalBlock}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{t.subtotal}</Text>
                <Text>
                  {formatAmount(total.subtotal, lang)} {total.currency}
                </Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>
                  {t.vat} ({formatQuantity(invoice.vat_rate, lang)}%)
                </Text>
                <Text>
                  {formatAmount(total.vat, lang)} {total.currency}
                </Text>
              </View>
              <View style={s.grand}>
                <Text>{t.totalDue}</Text>
                <Text>
                  {formatAmount(total.total, lang)} {total.currency}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.notes} wrap={false}>
          <Text style={s.heading}>{t.note.toUpperCase()}</Text>
          {noteLines.map((line, index) => (
            <Text key={index} style={s.noteLine}>
              {line || " "}
            </Text>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>
            {invoice.issuer.name} · {t.title} {invoice.number}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${t.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function invoiceFileName(invoice) {
  const prefix = invoice.language === "sr" ? "faktura" : "invoice";
  const safeNumber = invoice.number.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${prefix}-${safeNumber}.pdf`;
}
