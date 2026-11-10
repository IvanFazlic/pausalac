-- Paušalac invoicing schema.
--
-- Key rules enforced here rather than only in application code:
--   * company_profiles is append-only: every change to company data is a new
--     version, so older versions stay exactly as they were.
--   * an issued invoice stores a JSON snapshot of the issuer and the client and
--     is immutable afterwards. Only its status may change.
--   * invoice numbers are gap-free per year (invoice_counters).

-- ---------------------------------------------------------------------------
-- Company data (versioned) and application settings
-- ---------------------------------------------------------------------------

CREATE TABLE company_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  name          text NOT NULL,
  address       text NOT NULL DEFAULT '',
  pib           text NOT NULL DEFAULT '',
  mb            text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  website       text NOT NULL DEFAULT '',
  bank_name     text NOT NULL DEFAULT '',
  bank_account  text NOT NULL DEFAULT '',
  iban          text NOT NULL DEFAULT '',
  swift         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION company_profiles_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Company profile versions are append-only and cannot be changed or deleted';
END $$;

CREATE TRIGGER company_profiles_append_only
  BEFORE UPDATE OR DELETE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION company_profiles_guard();

CREATE TABLE settings (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_currency       text NOT NULL DEFAULT 'RSD' CHECK (default_currency ~ '^[A-Z]{3}$'),
  payment_terms_days     integer NOT NULL DEFAULT 7 CHECK (payment_terms_days BETWEEN 0 AND 365),
  invoice_number_format  text NOT NULL DEFAULT '{seq}/{year}',
  place_of_issue         text NOT NULL DEFAULT '',
  payment_method         text NOT NULL DEFAULT 'Prenos na račun',
  payment_purpose        text NOT NULL DEFAULT '',
  default_note           text NOT NULL DEFAULT E'Nisam u sistemu PDV-a prema članu 33. Zakona o PDV-u\nOva faktura je važeća bez potpisa i pečata',
  vat_rate               numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate BETWEEN 0 AND 100),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings DEFAULT VALUES;

-- ---------------------------------------------------------------------------
-- Clients, users, sessions
-- ---------------------------------------------------------------------------

CREATE TABLE clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  address             text NOT NULL DEFAULT '',
  pib                 text NOT NULL DEFAULT '',
  mb                  text NOT NULL DEFAULT '',
  email               text NOT NULL DEFAULT '',
  contact_name        text NOT NULL DEFAULT '',
  phone               text NOT NULL DEFAULT '',
  default_currency    text NOT NULL DEFAULT 'RSD' CHECK (default_currency ~ '^[A-Z]{3}$'),
  invoice_language    text NOT NULL DEFAULT 'sr' CHECK (invoice_language IN ('sr', 'en')),
  payment_terms_days  integer CHECK (payment_terms_days BETWEEN 0 AND 365),
  internal_notes      text NOT NULL DEFAULT '',
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL,
  name                  text NOT NULL DEFAULT '',
  password_hash         text NOT NULL,
  role                  text NOT NULL CHECK (role IN ('owner', 'client')),
  client_id             uuid REFERENCES clients(id) ON DELETE CASCADE,
  must_change_password  boolean NOT NULL DEFAULT false,
  disabled_at           timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- a client login always belongs to exactly one client; the owner to none
  CONSTRAINT users_role_client CHECK ((role = 'client') = (client_id IS NOT NULL))
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));
-- there is exactly one main account
CREATE UNIQUE INDEX users_single_owner ON users ((true)) WHERE role = 'owner';
CREATE INDEX users_client_id_idx ON users (client_id);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  ip          text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_created_at_idx ON login_attempts (created_at);

-- ---------------------------------------------------------------------------
-- Recurring (scheduled) invoices
-- ---------------------------------------------------------------------------

CREATE TABLE recurring_invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT '',
  frequency           text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  -- occurrence n falls on anchor_date + n weeks/months (month ends are clamped),
  -- so a schedule anchored on the 31st does not drift to the 28th.
  anchor_date         date NOT NULL,
  runs_count          integer NOT NULL DEFAULT 0,
  next_run_date       date,
  end_date            date,
  payment_terms_days  integer NOT NULL DEFAULT 7 CHECK (payment_terms_days BETWEEN 0 AND 365),
  payment_purpose     text NOT NULL DEFAULT '',
  note                text,
  items               jsonb NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  last_run_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_invoices_due_idx ON recurring_invoices (next_run_date) WHERE active;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

CREATE TABLE invoice_counters (
  year         integer PRIMARY KEY,
  last_number  integer NOT NULL CHECK (last_number >= 0)
);

CREATE FUNCTION format_invoice_number(fmt text, seq integer, yr integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result text := fmt;
  m text[];
  width integer;
  digits text := seq::text;
BEGIN
  LOOP
    m := regexp_match(result, '\{seq:(\d{1,2})\}');
    EXIT WHEN m IS NULL;
    width := m[1]::integer;
    result := replace(
      result,
      '{seq:' || m[1] || '}',
      CASE WHEN length(digits) >= width THEN digits ELSE lpad(digits, width, '0') END
    );
  END LOOP;
  result := replace(result, '{seq}', digits);
  result := replace(result, '{year}', yr::text);
  result := replace(result, '{yy}', lpad((yr % 100)::text, 2, '0'));
  RETURN result;
END $$;

CREATE TABLE invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year                  integer NOT NULL,
  seq                   integer NOT NULL,
  number                text NOT NULL UNIQUE,
  client_id             uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  company_profile_id    uuid NOT NULL REFERENCES company_profiles(id) ON DELETE RESTRICT,
  -- snapshots taken at the moment of issue
  issuer                jsonb NOT NULL,
  client_snapshot       jsonb NOT NULL,
  language              text NOT NULL DEFAULT 'sr' CHECK (language IN ('sr', 'en')),
  issue_date            date NOT NULL,
  service_date          date NOT NULL,
  due_date              date NOT NULL,
  place_of_issue        text NOT NULL DEFAULT '',
  payment_method        text NOT NULL DEFAULT '',
  payment_purpose       text NOT NULL DEFAULT '',
  note                  text NOT NULL DEFAULT '',
  vat_rate              numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate BETWEEN 0 AND 100),
  status                text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'cancelled')),
  paid_at               timestamptz,
  cancelled_at          timestamptz,
  recurring_invoice_id  uuid REFERENCES recurring_invoices(id) ON DELETE SET NULL,
  scheduled_for         date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_year_seq_key UNIQUE (year, seq),
  -- one invoice per schedule occurrence, even if two runs race
  CONSTRAINT invoices_recurring_run_key UNIQUE (recurring_invoice_id, scheduled_for),
  CONSTRAINT invoices_due_after_issue CHECK (due_date >= issue_date)
);

CREATE INDEX invoices_client_idx ON invoices (client_id, issue_date DESC);
CREATE INDEX invoices_status_idx ON invoices (status, due_date);

CREATE TABLE invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  position     integer NOT NULL,
  description  text NOT NULL CHECK (description <> ''),
  unit         text NOT NULL DEFAULT '',
  quantity     numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price   numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount       numeric(14,2) NOT NULL,
  CONSTRAINT invoice_items_position_key UNIQUE (invoice_id, position)
);

-- Issued invoices are frozen: only status, payment/cancellation timestamps and
-- the link to a (possibly deleted) schedule may change.
CREATE FUNCTION invoices_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Invoice % cannot be deleted', OLD.number;
  END IF;

  IF ROW(NEW.id, NEW.year, NEW.seq, NEW.number, NEW.client_id, NEW.company_profile_id,
         NEW.issuer, NEW.client_snapshot, NEW.language, NEW.issue_date, NEW.service_date,
         NEW.due_date, NEW.place_of_issue, NEW.payment_method, NEW.payment_purpose,
         NEW.note, NEW.vat_rate, NEW.scheduled_for, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.year, OLD.seq, OLD.number, OLD.client_id, OLD.company_profile_id,
         OLD.issuer, OLD.client_snapshot, OLD.language, OLD.issue_date, OLD.service_date,
         OLD.due_date, OLD.place_of_issue, OLD.payment_method, OLD.payment_purpose,
         OLD.note, OLD.vat_rate, OLD.scheduled_for, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Invoice % has been issued and its contents cannot be changed', OLD.number;
  END IF;

  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Invoice % is cancelled and cannot be reopened', OLD.number;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER invoices_immutable
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_guard();

-- Items can only be written in the same transaction that creates the invoice
-- (invoices.created_at defaults to now(), the transaction start time).
CREATE FUNCTION invoice_items_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  invoice_created timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT created_at INTO invoice_created FROM invoices WHERE id = NEW.invoice_id;
    IF invoice_created IS NULL THEN
      RAISE EXCEPTION 'Invoice could not be created: client or company details are missing';
    END IF;
    IF invoice_created <> now() THEN
      RAISE EXCEPTION 'Items cannot be added to an invoice that has already been issued';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Items of an issued invoice cannot be changed or deleted';
END $$;

CREATE TRIGGER invoice_items_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION invoice_items_guard();

-- Totals are always derived from the frozen items, one row per currency.
CREATE VIEW invoice_totals AS
SELECT
  i.id AS invoice_id,
  it.currency,
  sum(it.amount) AS subtotal,
  round(sum(it.amount) * i.vat_rate / 100, 2) AS vat,
  sum(it.amount) + round(sum(it.amount) * i.vat_rate / 100, 2) AS total
FROM invoices i
JOIN invoice_items it ON it.invoice_id = i.id
GROUP BY i.id, i.vat_rate, it.currency;
