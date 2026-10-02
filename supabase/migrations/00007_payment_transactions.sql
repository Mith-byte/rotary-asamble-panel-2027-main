-- Migration: Payment Transactions Table
-- Çalıştırın: Supabase Dashboard > SQL Editor

-- 1. payment_status enum'ı ekle
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- 2. payment_transactions tablosunu oluştur
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  -- Sanal POS sağlayıcısından dönen işlem numarası
  pos_transaction_id text,
  -- Sanal POS sağlayıcısından dönen sipariş numarası
  merchant_order_id text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  -- POS'tan dönen ham yanıt (hata ayıklama için)
  pos_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Updated_at trigger
CREATE TRIGGER set_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Index'ler
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_transactions_pos_transaction_id ON public.payment_transactions(pos_transaction_id);

-- 5. RLS politikaları
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi işlemlerini görebilir
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Sadece service role yazabilir (API callback'ten)
-- INSERT/UPDATE için RLS devre dışı bırakılıyor (service_role bypass ediyor)
