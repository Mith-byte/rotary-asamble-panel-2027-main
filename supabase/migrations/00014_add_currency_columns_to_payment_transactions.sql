-- Migration 00014: Döviz Kuru ve Orijinal Tutar Kolonları
-- payment_transactions tablosuna Euro tutarı ve kur bilgisi kolonlarını ekler

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS original_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS original_currency text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(10, 4);

COMMENT ON COLUMN public.payment_transactions.original_amount IS 'Kullanıcının seçtiği paketin orijinal Euro (€) tutarı';
COMMENT ON COLUMN public.payment_transactions.original_currency IS 'Orijinal para birimi (varsayılan EUR)';
COMMENT ON COLUMN public.payment_transactions.exchange_rate IS 'Ödeme anında TCMB veya yedek kaynaktan uygulanan EUR/TRY kuru';
