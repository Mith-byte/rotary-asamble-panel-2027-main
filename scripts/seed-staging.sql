-- Seed the staging database.
-- Run in the staging Supabase SQL editor, after the migrations.
--
-- The nine packages are NOT seeded here any more: they are fixed reference data
-- issued by the district and are created by 00002_packages.sql, keyed on their
-- contractual ids. Re-inserting them here would let staging and production
-- drift apart.

-- Kayıt dönemleri. PLACEHOLDER DATES, staging only. The district has not issued
-- registration dates; production must not receive these. Windows are contiguous
-- and non-overlapping — a gap makes the public site show no active period, and
-- an overlap makes it pick the first match.
TRUNCATE public.pricing_periods CASCADE;

INSERT INTO public.pricing_periods (id, label, starts_at, ends_at) VALUES
  ('early_bird', 'Erken kayıt', '2026-09-01 00:00:00+03', '2026-11-30 23:59:59+03'),
  ('round_1',    '1. dönem',    '2026-12-01 00:00:00+03', '2027-01-31 23:59:59+03'),
  ('round_2',    '2. dönem',    '2027-02-01 00:00:00+03', '2027-03-15 23:59:59+03');

-- Paket ücretleri are deliberately left null: no figure has been issued for any
-- of the nine packages, and staging should exercise the priceless case. To try
-- a populated price on staging, update a single row by hand, e.g.
--   UPDATE public.packages SET early_bird_price = 1, early_bird_installment_price = 1
--   WHERE id = '1k-3g';
