-- Changes needed to hold real invoices:
--   * hourly rates need more than two decimals (160 h x 11.375 EUR)
--   * each client can have its own invoice number series
--   * invoices in a foreign currency print international payment details
--   * English invoices get their own default note and payment method wording

-- ---------------------------------------------------------------------------
-- Unit prices with up to four decimals. Line amounts stay rounded to cents.
-- ---------------------------------------------------------------------------

ALTER TABLE invoice_items ALTER COLUMN unit_price TYPE numeric(16,4);

-- ---------------------------------------------------------------------------
-- Per-client number series
-- ---------------------------------------------------------------------------

-- NULL means "use the general format from settings".
ALTER TABLE clients ADD COLUMN number_format text;
ALTER TABLE clients ADD COLUMN country text NOT NULL DEFAULT '';

CREATE TABLE client_invoice_counters (
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year         integer NOT NULL,
  last_number  integer NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (client_id, year)
);

-- With several series, the running number is only unique within its series,
-- and month-based numbers ("04/2026") have no running number at all.
-- The full invoice number stays unique.
ALTER TABLE invoices DROP CONSTRAINT invoices_year_seq_key;
ALTER TABLE invoices ALTER COLUMN seq DROP NOT NULL;

DROP FUNCTION format_invoice_number(text, integer, integer);

-- Placeholders: {seq}, {seq:4} (zero-padded), {year}, {yy}, {mm} (month of issue).
CREATE FUNCTION format_invoice_number(fmt text, seq integer, issued date) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result text := fmt;
  m text[];
  width integer;
  digits text := coalesce(seq::text, '');
  yr integer := extract(year FROM issued)::integer;
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
  result := replace(result, '{mm}', lpad(extract(month FROM issued)::integer::text, 2, '0'));
  RETURN result;
END $$;

-- A month-based series has no running number, so a second invoice in the same
-- month would repeat the number. It gets "-2", "-3", ... instead.
CREATE FUNCTION unique_invoice_number(base text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT c.candidate
  FROM (
    SELECT base AS candidate, 1 AS n
    UNION ALL
    SELECT base || '-' || g, g FROM generate_series(2, 99) AS g
  ) c
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.number = c.candidate)
  ORDER BY c.n
  LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- International payment details, versioned with the rest of the company data
-- ---------------------------------------------------------------------------

ALTER TABLE company_profiles
  ADD COLUMN bank_address            text NOT NULL DEFAULT '',
  ADD COLUMN foreign_holder          text NOT NULL DEFAULT '',
  ADD COLUMN foreign_holder_address  text NOT NULL DEFAULT '',
  -- One bank per line. A line starting with a currency code and a colon
  -- ("EUR: ...") is printed only on invoices in that currency.
  ADD COLUMN correspondent_banks     text NOT NULL DEFAULT '',
  ADD COLUMN payment_note            text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Defaults for English invoices
-- ---------------------------------------------------------------------------

ALTER TABLE settings
  ADD COLUMN default_note_en    text NOT NULL DEFAULT E'Not in the VAT system pursuant to Article 33 of the Serbian Law on VAT.\nThis invoice is valid without a signature and stamp.',
  ADD COLUMN payment_method_en  text NOT NULL DEFAULT 'Bank transfer';
