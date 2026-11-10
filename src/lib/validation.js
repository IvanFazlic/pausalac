import { z } from "zod";
import { isISODate } from "./dates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (max = 200) => z.string().trim().max(max, `Use at most ${max} characters`);
const requiredText = (max = 200) => text(max).min(1, "This field is required");
const multiline = (max = 2000) =>
  z.string().max(max, `Use at most ${max} characters`).transform((v) => v.replace(/\r\n/g, "\n").trim());

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(EMAIL_RE, "Enter a valid email address");
const optionalEmail = text(200).refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid email address");

const uuid = z.string().regex(UUID_RE, "Invalid selection");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const isoDate = z.string().refine(isISODate, "Enter a valid date");
const optionalDate = z
  .string()
  .refine((v) => v === "" || isISODate(v), "Enter a valid date")
  .transform((v) => (v === "" ? null : v));

const days = z.coerce
  .number({ error: "Enter a number of days" })
  .int("Enter whole days")
  .min(0, "Cannot be negative")
  .max(365, "Use at most 365 days");
const optionalDays = z.preprocess((v) => (v === "" || v == null ? null : v), days.nullable());

// Decimal kept as a string so no precision is lost on the way to Postgres.
const decimal = (maxInt, maxFraction) =>
  z
    .string()
    .transform((v) => v.trim().replace(/\s/g, "").replace(",", "."))
    .pipe(
      z
        .string()
        .regex(
          new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${maxFraction}})?$`),
          `Enter a number with up to ${maxFraction} decimals`
        )
    );

const vatRate = decimal(3, 2).refine((v) => Number(v) <= 100, "Use a rate between 0 and 100");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200, "Use at most 200 characters");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});

export const setupSchema = z.object({
  name: requiredText(120),
  email,
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

export const ownerProfileSchema = z.object({
  name: requiredText(120),
  email,
});

export const companySchema = z.object({
  name: requiredText(200),
  address: text(300),
  pib: text(30),
  mb: text(30),
  phone: text(50),
  email: optionalEmail,
  website: text(200),
  bank_name: text(120),
  bank_account: text(60),
  iban: text(60),
  swift: text(20),
});

export const settingsSchema = z.object({
  default_currency: currency,
  payment_terms_days: days,
  invoice_number_format: text(40)
    .min(1, "This field is required")
    .regex(/^[A-Za-z0-9\-_/.{}: ]+$/, "Use letters, digits, - _ / . and the {seq} {year} placeholders")
    .refine((v) => /\{seq(:\d{1,2})?\}/.test(v), "Include {seq} so every invoice gets its own number")
    .refine((v) => /\{year\}|\{yy\}/.test(v), "Include {year} or {yy}, because numbering restarts each year"),
  place_of_issue: text(100),
  payment_method: text(100),
  payment_purpose: text(200),
  default_note: multiline(2000),
  vat_rate: vatRate,
});

export const nextNumberSchema = z.object({
  next_number: z.coerce
    .number({ error: "Enter a number" })
    .int("Enter a whole number")
    .min(1, "Must be at least 1")
    .max(99999999, "Number is too large"),
});

export const clientSchema = z.object({
  name: requiredText(200),
  address: text(300),
  pib: text(30),
  mb: text(30),
  email: optionalEmail,
  contact_name: text(120),
  phone: text(50),
  default_currency: currency,
  invoice_language: z.enum(["sr", "en"]),
  payment_terms_days: optionalDays,
  internal_notes: multiline(2000),
});

export const clientUserSchema = z.object({
  email,
  name: text(120),
});

export const itemSchema = z.object({
  description: requiredText(500),
  unit: text(20).default(""),
  quantity: decimal(9, 3).refine((v) => Number(v) > 0, "Must be greater than 0"),
  unit_price: decimal(11, 2),
  currency,
});

export const itemsSchema = z
  .array(itemSchema)
  .min(1, "Add at least one item")
  .max(100, "Use at most 100 items");

export const invoiceSchema = z
  .object({
    clientId: uuid,
    issueDate: isoDate,
    serviceDate: isoDate,
    dueDate: isoDate,
    placeOfIssue: text(100),
    paymentMethod: text(100),
    paymentPurpose: text(200),
    note: multiline(2000),
    vatRate,
    items: itemsSchema,
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    path: ["dueDate"],
    message: "Due date cannot be before the issue date",
  });

export const recurringSchema = z
  .object({
    clientId: uuid,
    name: text(120),
    frequency: z.enum(["weekly", "monthly"]),
    nextDate: isoDate,
    endDate: optionalDate,
    paymentTermsDays: days,
    paymentPurpose: text(200),
    note: multiline(2000),
    items: itemsSchema,
  })
  .refine((v) => !v.endDate || v.endDate >= v.nextDate, {
    path: ["endDate"],
    message: "End date cannot be before the next invoice date",
  });

// First message per field, keyed by dotted path ("items.0.quantity").
export function toFieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formToObject(formData) {
  const out = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
