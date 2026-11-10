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
    beneficiary: "Korisnik",
    beneficiaryBank: "Banka korisnika",
    correspondent: "Korespondentska banka",
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
    beneficiary: "Beneficiary",
    beneficiaryBank: "Beneficiary bank",
    correspondent: "Correspondent bank",
    purpose: "Payment purpose",
    reference: "Payment reference",
    cancelled: "CANCELLED",
    page: "Page",
  },
};

export function labelsFor(language) {
  return INVOICE_LABELS[language] ?? INVOICE_LABELS.sr;
}

export function invoiceCurrencies(invoice) {
  return [...new Set(invoice.items.map((item) => item.currency))];
}

export function singleCurrency(invoice) {
  const currencies = invoiceCurrencies(invoice);
  return currencies.length === 1 ? currencies[0] : null;
}

// An invoice with nothing in dinars is paid from abroad: it shows the IBAN
// and SWIFT instead of the dinar account.
function paidFromAbroad(invoice) {
  const currencies = invoiceCurrencies(invoice);
  return currencies.length > 0 && !currencies.includes("RSD");
}

// Rows of "label: value" for the issuer and the buyer, skipping empty values,
// built from the snapshots stored on the invoice.
export function issuerRows(invoice, t) {
  const issuer = invoice.issuer;
  const abroad = paidFromAbroad(invoice);
  return [
    [t.name, issuer.name],
    [t.address, issuer.address],
    [t.pib, issuer.pib],
    [t.mb, issuer.mb],
    [t.contact, issuer.phone],
    [t.email, issuer.email],
    [t.website, issuer.website],
    [t.bankName, issuer.bank_name],
    abroad ? [t.iban, issuer.iban] : [t.bankAccount, issuer.bank_account],
    abroad ? [t.swift, issuer.swift] : [t.iban, issuer.bank_account ? "" : issuer.iban],
  ].filter(([, value]) => value);
}

const HOME_COUNTRIES = ["", "serbia", "srbija", "republika srbija", "republic of serbia"];

export function buyerRows(buyer, t) {
  const country = buyer.country ?? "";
  const address = HOME_COUNTRIES.includes(country.trim().toLowerCase())
    ? buyer.address
    : [buyer.address, country].filter(Boolean).join(", ");
  return [
    [t.name, buyer.name],
    [t.address, address],
    [t.pib, buyer.pib],
    [t.mb, buyer.mb],
    [t.contact, buyer.contact_name],
    [t.email, buyer.email],
  ].filter(([, value]) => value);
}

// Correspondent banks are stored one per line; a line starting with
// "EUR: " is only shown on invoices that contain that currency.
function correspondentBanks(text, currencies) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^([A-Z]{3})\s*:\s*(.+)$/);
      if (!match) return [line];
      if (!currencies.includes(match[1])) return [];
      return [currencies.length > 1 ? `${match[2]} (${match[1]})` : match[2]];
    });
}

// Payment instructions shown under the note: the dinar account for dinar
// amounts, international details for foreign-currency amounts.
export function paymentLines(invoice, t) {
  const issuer = invoice.issuer;
  const currencies = invoiceCurrencies(invoice);
  const foreign = currencies.filter((currency) => currency !== "RSD");
  const lines = [];

  if (foreign.length === 0 || currencies.includes("RSD")) {
    const account = issuer.bank_account || issuer.iban;
    if (account) lines.push(`${t.payTo}: ${account}`);
  }
  if (foreign.length > 0 && issuer.iban) {
    const holder = [issuer.foreign_holder || issuer.name, issuer.foreign_holder_address].filter(Boolean).join(", ");
    const bank = [issuer.bank_name, issuer.bank_address, issuer.swift ? `SWIFT ${issuer.swift}` : ""]
      .filter(Boolean)
      .join(", ");
    lines.push(`${t.beneficiary}: ${holder}`);
    lines.push(`IBAN: ${issuer.iban}`);
    if (bank) lines.push(`${t.beneficiaryBank}: ${bank}`);
    for (const line of correspondentBanks(issuer.correspondent_banks, foreign)) {
      lines.push(`${t.correspondent}: ${line}`);
    }
    for (const line of String(issuer.payment_note ?? "").split("\n")) {
      if (line.trim()) lines.push(line.trim());
    }
  }
  if (invoice.payment_purpose) lines.push(`${t.purpose}: ${invoice.payment_purpose}`);
  lines.push(`${t.reference}: ${invoice.number}`);
  return lines;
}
