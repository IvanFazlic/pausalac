// Wording of the invoice document itself (on screen and in the PDF).
// The app UI is English; the invoice follows the client's invoice language.

export const INVOICE_LABELS = {
  sr: {
    title: "FAKTURA",
    issuer: "PODACI IZDAVAOCA",
    buyer: "PODACI KUPCA",
    name: "Naziv",
    address: "Adresa",
    pib: "PIB",
    mb: "MB",
    contact: "Kontakt",
    email: "Email",
    website: "Web",
    bankAccount: "Račun banke",
    bankName: "Banka",
    iban: "IBAN",
    swift: "SWIFT",
    number: "Broj fakture",
    issueDate: "Datum izdavanja",
    serviceDate: "Datum prometa",
    dueDate: "Rok plaćanja",
    place: "Mesto izdavanja",
    currency: "Valuta",
    paymentMethod: "Način plaćanja",
    description: "Opis",
    unit: "Jed. mere",
    quantity: "Količina",
    unitPrice: "Cena po jedinici",
    amount: "Ukupno",
    subtotal: "Međuzbir",
    vatRate: "PDV stopa",
    vat: "PDV",
    totalDue: "Ukupno za uplatu",
    note: "Napomena",
    payTo: "Uplatu izvršiti na račun",
    purpose: "Svrha uplate",
    reference: "Poziv na broj",
    cancelled: "STORNIRANO",
    page: "Strana",
  },
  en: {
    title: "INVOICE",
    issuer: "FROM",
    buyer: "BILL TO",
    name: "Name",
    address: "Address",
    pib: "Tax ID (PIB)",
    mb: "Reg. No. (MB)",
    contact: "Phone",
    email: "Email",
    website: "Web",
    bankAccount: "Bank account",
    bankName: "Bank",
    iban: "IBAN",
    swift: "SWIFT",
    number: "Invoice number",
    issueDate: "Issue date",
    serviceDate: "Date of supply",
    dueDate: "Due date",
    place: "Place of issue",
    currency: "Currency",
    paymentMethod: "Payment method",
    description: "Description",
    unit: "Unit",
    quantity: "Quantity",
    unitPrice: "Unit price",
    amount: "Amount",
    subtotal: "Subtotal",
    vatRate: "VAT rate",
    vat: "VAT",
    totalDue: "Total due",
    note: "Note",
    payTo: "Please pay to account",
    purpose: "Payment purpose",
    reference: "Payment reference",
    cancelled: "CANCELLED",
    page: "Page",
  },
};

export function labelsFor(language) {
  return INVOICE_LABELS[language] ?? INVOICE_LABELS.sr;
}

// Rows of "label: value" for the issuer and the buyer, skipping empty values,
// built from the snapshots stored on the invoice.
export function issuerRows(issuer, t) {
  return [
    [t.name, issuer.name],
    [t.address, issuer.address],
    [t.pib, issuer.pib],
    [t.mb, issuer.mb],
    [t.contact, issuer.phone],
    [t.email, issuer.email],
    [t.website, issuer.website],
    [t.bankName, issuer.bank_name],
    [t.bankAccount, issuer.bank_account],
    [t.iban, issuer.iban],
    [t.swift, issuer.swift],
  ].filter(([, value]) => value);
}

export function buyerRows(buyer, t) {
  return [
    [t.name, buyer.name],
    [t.address, buyer.address],
    [t.pib, buyer.pib],
    [t.mb, buyer.mb],
    [t.contact, buyer.contact_name],
    [t.email, buyer.email],
  ].filter(([, value]) => value);
}

// Payment instructions shown under the note, as in the original template.
export function paymentLines(invoice, t) {
  const account = invoice.issuer.bank_account || invoice.issuer.iban;
  return [
    account ? `${t.payTo}: ${account}` : null,
    invoice.payment_purpose ? `${t.purpose}: ${invoice.payment_purpose}` : null,
    `${t.reference}: ${invoice.number}`,
  ].filter(Boolean);
}

export function singleCurrency(invoice) {
  const currencies = new Set(invoice.items.map((item) => item.currency));
  return currencies.size === 1 ? [...currencies][0] : null;
}
