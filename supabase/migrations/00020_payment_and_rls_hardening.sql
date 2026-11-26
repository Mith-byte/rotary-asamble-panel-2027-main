-- Migration 00020: Sanal POS, Ödeme Güvenliği ve RLS Yetkilendirme Sıkılaştırması
-- Supabase SQL Editor üzerinden çalıştırılabilir (Idempotent)

-- ==============================================================================
-- 1. PROFİL GÜVENLİK TETİKLEYİCİSİ (Sıkılaştırma)
-- Normal kullanıcıların role, status, total_amount, pricing_type değiştirmesini engeller.
-- Ayrıca ödemesi onaylanmış (accepted) kullanıcıların paketini veya oda ID'sini
-- doğrudan değiştirmesini engelleyerek ödeme sonrası yetkisiz paket yükseltmeyi önler.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  -- 1. Service role veya veritabanı yöneticisi (postgres / supabase_admin) kontrolü
  BEGIN
    v_jwt_role := coalesce(
      auth.role(),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
      current_setting('request.jwt.claim.role', true),
      current_setting('role', true)
    );
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := NULL;
  END;

  -- Backend Admin Client (service_role), postgres veya supabase_admin ise tüm güncellemelere izin ver
  IF v_jwt_role = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin')
     OR coalesce(current_setting('role', true), '') IN ('service_role', 'postgres')
     OR auth.uid() IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- 2. Normal kullanıcılar (authenticated) kritik alanları manipüle edemez:
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Rol (role) bilgisi doğrudan değiştirilemez.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Kayıt ve ödeme durumu (status) doğrudan değiştirilemez.';
  END IF;

  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Toplam sepet tutarı (total_amount) doğrudan değiştirilemez.';
  END IF;

  IF NEW.pricing_type IS DISTINCT FROM OLD.pricing_type THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Fiyatlandırma dönemi (pricing_type) doğrudan değiştirilemez.';
  END IF;

  -- 3. Ödemesi tamamlanmış kullanıcının paket veya oda bilgisini manipüle etmesini engelle:
  IF OLD.status = 'accepted' THEN
    IF NEW.package_id IS DISTINCT FROM OLD.package_id THEN
      RAISE EXCEPTION 'Yetkisiz işlem: Ödemesi tamamlanmış bir kaydın paketi doğrudan değiştirilemez. Lütfen yönetimle iletişime geçin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- ==============================================================================
-- 2. TABLO BAZLI RLS POLİTİKALARININ TEYİT VE EKSİKLERİNİN KAPATILMASI
-- ==============================================================================

-- A. payment_transactions: Kullanıcılar yalnızca kendi işlemlerini okuyabilir.
-- Asla doğrudan INSERT, UPDATE veya DELETE yapamazlar.
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Olası hatalı eklenmiş yazma politikalarını temizle
DROP POLICY IF EXISTS "Users can insert transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON public.payment_transactions;

-- B. profiles tablosu RLS güvencesi
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- C. room_guests tablosu RLS güvencesi
ALTER TABLE public.room_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view own or roommate guests" ON public.room_guests;
CREATE POLICY "Users can only view own or roommate guests"
  ON public.room_guests FOR SELECT
  USING (
    auth.uid() = registered_by
    OR room_id IN (
      SELECT p.room_id FROM public.profiles p WHERE p.id = auth.uid() AND p.room_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can manage own room guests" ON public.room_guests;
CREATE POLICY "Users can manage own room guests"
  ON public.room_guests FOR ALL
  USING (auth.uid() = registered_by)
  WITH CHECK (auth.uid() = registered_by);

-- D. rooms tablosu RLS güvencesi
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;
CREATE POLICY "Anyone can read rooms"
  ON public.rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- E. packages ve pricing_periods tabloları (Salt Okunur)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read packages" ON public.packages;
CREATE POLICY "Anyone can read packages"
  ON public.packages FOR SELECT
  USING (true);

ALTER TABLE public.pricing_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read pricing_periods" ON public.pricing_periods;
CREATE POLICY "Anyone can read pricing_periods"
  ON public.pricing_periods FOR SELECT
  USING (true);
