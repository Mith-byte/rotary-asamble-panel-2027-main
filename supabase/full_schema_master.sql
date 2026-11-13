-- ==============================================================================
-- ROTARY 2440 BÖLGE ASAMBLESİ - TEK PARÇA MASTER VERİTABANI KURULUM ŞEMASI (SQL)
-- ==============================================================================
-- Bu dosya, projedeki tüm migration'ların (00001 - 00018) nihai ve en güncel halini
-- sıfırdan kurulan yeni bir Supabase projesinde tek seferde ve hatasız çalıştırılacak
-- şekilde birleştirilmiş halidir.
--
-- Çalıştırma: Yeni Supabase Dashboard > SQL Editor > New query > Yapıştır ve RUN et.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUM TİPLERİ
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('waiting', 'accepted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pricing_type AS ENUM ('early_bird', 'round_1', 'round_2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.gender AS ENUM ('Erkek', 'Kadın');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM ('pending', 'accepted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'paid', 'success');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 2. ORTAK TETİKLEYİCİ FONKSİYONLARI (updated_at)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. PAKETLER (packages) VE KAYIT DÖNEMLERİ (pricing_periods)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  "group" text NOT NULL CHECK ("group" IN ('konaklamalı', 'konaklamasız')),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 6),
  nights integer NOT NULL DEFAULT 0 CHECK (nights BETWEEN 0 AND 3),
  ceremony boolean NOT NULL,
  gala boolean NOT NULL,
  sort_order integer NOT NULL UNIQUE,
  early_bird_price numeric(10,2),
  early_bird_installment_price numeric(10,2),
  round_1_price numeric(10,2),
  round_1_installment_price numeric(10,2),
  round_2_price numeric(10,2),
  round_2_installment_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT packages_id_check CHECK (id IN (
    '1k-3g', '2k-3g', '3k-3g',
    '1k-2g', '2k-2g', '3k-2g',
    '1k-1g', '2k-1g', '3k-1g',
    'aile-1g', 'aile-2g', 'aile-3g',
    'gala-toren', 'toren', 'gala'
  ))
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read packages" ON public.packages;
CREATE POLICY "Anyone can read packages"
  ON public.packages FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS set_packages_updated_at ON public.packages;
CREATE TRIGGER set_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fiyat Dönemleri Tablosu
CREATE TABLE IF NOT EXISTS public.pricing_periods (
  id public.pricing_type PRIMARY KEY,
  label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.pricing_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pricing periods" ON public.pricing_periods;
CREATE POLICY "Anyone can read pricing periods"
  ON public.pricing_periods FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- 4. ODALAR (rooms) TABLOSU (profiles ile karşılıklı referans)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 6),
  remaining_capacity integer NOT NULL DEFAULT 0 CHECK (remaining_capacity >= 0),
  room_type text DEFAULT 'standard',
  created_by uuid, -- Alt tarafta profiles oluştuktan sonra FK eklenecek
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rooms" ON public.rooms;
CREATE POLICY "Anyone can read rooms"
  ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. KULLANICI PROFİLLERİ (profiles) TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email text,
  phone text,
  first_name text,
  last_name text,
  club text,
  gender public.gender,
  tc_kimlik text,
  birth_date date,
  donor_types text[] DEFAULT '{}',
  room_registration_type text DEFAULT 'individual',
  roommate_preference_1 text,
  roommate_preference_2 text,
  gorev text CHECK (gorev IS NULL OR gorev IN (
    -- Kulüp
    'baskan-2627', 'gecmis-baskan', 'baskan-2728', 'sekreter', 'sayman',
    'vakif-komite-bsk', 'uyelik-komite-bsk', 'komite-bsk', 'uye',
    -- Bölge
    'guvernor', 'gecmis-guvernor', 'gelecek-guvernor', 'guvernor-adayi',
    'bolge-gorevlisi', 'bolge-komite-uyesi',
    -- Rotaract
    'rotaractor', 'brt', 'brt-gelecek', 'brt-gecmis', 'bolge-gorevlisi-rotaract',
    -- Interact
    'interactor', 'bit', 'bit-gelecek', 'bit-gecmis', 'bolge-gorevlisi-interact',
    -- Misafir
    'misafir'
  )),
  package_id text REFERENCES public.packages(id),
  pricing_type public.pricing_type,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  total_amount numeric(10, 2),
  has_roommate boolean DEFAULT false,
  guest_count integer DEFAULT 0,
  dekont_url text,
  status public.user_status NOT NULL DEFAULT 'waiting',
  role public.user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- rooms.created_by referansını tamamla
DO $$ BEGIN
  ALTER TABLE public.rooms
    ADD CONSTRAINT rooms_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_gorev ON public.profiles(gorev);
CREATE INDEX IF NOT EXISTS idx_profiles_room_id ON public.profiles(room_id);

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

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auth trigger: Yeni kullanıcı kaydolduğunda otomatik profiles satırı aç
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'user')
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Yetki yükseltme ve veri manipülasyonu güvenlik koruması (Privilege Escalation Defense)
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  -- Service role veya veritabanı yöneticisi kontrolü
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

  IF v_jwt_role = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin')
     OR coalesce(current_setting('role', true), '') IN ('service_role', 'postgres')
     OR auth.uid() IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Normal kullanıcılar (authenticated) kritik alanları doğrudan değiştiremez
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Rol (role) bilgisi doğrudan değiştirilemez.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Kayıt durumu (status) doğrudan değiştirilemez.';
  END IF;

  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Tutar (total_amount) doğrudan değiştirilemez.';
  END IF;

  IF NEW.pricing_type IS DISTINCT FROM OLD.pricing_type THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Fiyatlandırma dönemi (pricing_type) doğrudan değiştirilemez.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- ------------------------------------------------------------------------------
-- 6. ODA MİSAFİRLERİ (room_guests) TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  registered_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_type text NOT NULL CHECK (guest_type IN ('adult', 'child')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  tc_kimlik text,
  phone text,
  email text,
  gender text CHECK (gender IS NULL OR gender IN ('Erkek', 'Kadın')),
  club text,
  birth_date date,
  age integer,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  donor_types text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_guests_room_id ON public.room_guests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_guests_registered_by ON public.room_guests(registered_by);

ALTER TABLE public.room_guests ENABLE ROW LEVEL SECURITY;

-- KVKK Korunmalı Okuma Politikası
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

DROP TRIGGER IF EXISTS set_room_guests_updated_at ON public.room_guests;
CREATE TRIGGER set_room_guests_updated_at
  BEFORE UPDATE ON public.room_guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic Room Join RPC
CREATE OR REPLACE FUNCTION public.join_room_atomic(
  p_room_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room record;
BEGIN
  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı');
  END IF;

  IF v_room.remaining_capacity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda kapasitesi dolu');
  END IF;

  UPDATE public.rooms
  SET remaining_capacity = remaining_capacity - 1,
      updated_at = now()
  WHERE id = p_room_id;

  UPDATE public.profiles
  SET room_id = p_room_id,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'remaining_capacity', v_room.remaining_capacity - 1);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ODA DAVETLERİ (room_invitations) TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  invited_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
  ON public.room_invitations (room_id, invited_user_id) WHERE (status = 'pending');

ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own invitations" ON public.room_invitations;
CREATE POLICY "Users can read own invitations"
  ON public.room_invitations FOR SELECT
  USING (auth.uid() = invited_by OR auth.uid() = invited_user_id);

DROP POLICY IF EXISTS "Users can insert invitations" ON public.room_invitations;
CREATE POLICY "Users can insert invitations"
  ON public.room_invitations FOR INSERT
  WITH CHECK (auth.uid() = invited_by);

DROP POLICY IF EXISTS "Users can update own invitations" ON public.room_invitations;
CREATE POLICY "Users can update own invitations"
  ON public.room_invitations FOR UPDATE
  USING (auth.uid() = invited_by OR auth.uid() = invited_user_id);

DROP TRIGGER IF EXISTS set_room_invitations_updated_at ON public.room_invitations;
CREATE TRIGGER set_room_invitations_updated_at
  BEFORE UPDATE ON public.room_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. HAVALE / EFT TAKSİT TAKİBİ (installments) TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  installment_number integer NOT NULL CHECK (installment_number BETWEEN 1 AND 3),
  amount integer NOT NULL,
  dekont_url text,
  status public.installment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, installment_number)
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own installments" ON public.installments;
CREATE POLICY "Users can read own installments"
  ON public.installments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own installments" ON public.installments;
CREATE POLICY "Users can update own installments"
  ON public.installments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own installments" ON public.installments;
CREATE POLICY "Users can insert own installments"
  ON public.installments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_installments_updated_at ON public.installments;
CREATE TRIGGER set_installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. SANAL POS ÖDEME İŞLEMLERİ (payment_transactions) TABLOSU
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  original_amount numeric(10, 2),
  original_currency text DEFAULT 'EUR',
  exchange_rate numeric(10, 4),
  pos_transaction_id text,
  merchant_order_id text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  pos_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_pos_transaction_id ON public.payment_transactions(pos_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant_order_id ON public.payment_transactions(merchant_order_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER set_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. STORAGE (DEKONT BUCKET) AYARLARI
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('dekontlar', 'dekontlar', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can read own dekont" ON storage.objects;
CREATE POLICY "Users can read own dekont"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dekontlar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own dekont" ON storage.objects;
CREATE POLICY "Users can upload own dekont"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dekontlar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own dekont" ON storage.objects;
CREATE POLICY "Users can update own dekont"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dekontlar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'dekontlar'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------------------
-- 11. BAŞLANGIÇ VERİLERİ (PAKETLER VE FİYAT TANIMLARI)
-- ------------------------------------------------------------------------------
-- 15 adet güncel paket tanımı ve kişi başı Euro (€) dönem fiyatları
INSERT INTO public.packages (
  id, name, "group", capacity, nights, ceremony, gala, sort_order,
  early_bird_price, round_1_price, round_2_price
) VALUES
  -- 1 Gece Konaklamalı
  ('1k-1g',      '1 Kişi • 1 Gece Konaklama',       'konaklamalı',  1, 1, true,  true,  1,  350.00, 375.00, 395.00),
  ('2k-1g',      '2 Kişi • 1 Gece Konaklama',       'konaklamalı',  2, 1, true,  true,  2,  275.00, 300.00, 315.00),
  ('3k-1g',      '3 Kişi • 1 Gece Konaklama',       'konaklamalı',  3, 1, true,  true,  3,  265.00, 290.00, 305.00),

  -- 2 Gece Konaklamalı
  ('1k-2g',      '1 Kişi • 2 Gece Konaklama',       'konaklamalı',  1, 2, true,  true,  4,  525.00, 550.00, 575.00),
  ('2k-2g',      '2 Kişi • 2 Gece Konaklama',       'konaklamalı',  2, 2, true,  true,  5,  380.00, 405.00, 420.00),
  ('3k-2g',      '3 Kişi • 2 Gece Konaklama',       'konaklamalı',  3, 2, true,  true,  6,  360.00, 385.00, 400.00),

  -- 3 Gece Konaklamalı
  ('1k-3g',      '1 Kişi • 3 Gece Konaklama',       'konaklamalı',  1, 3, true,  true,  7,  700.00, 725.00, 750.00),
  ('2k-3g',      '2 Kişi • 3 Gece Konaklama',       'konaklamalı',  2, 3, true,  true,  8,  500.00, 525.00, 540.00),
  ('3k-3g',      '3 Kişi • 3 Gece Konaklama',       'konaklamalı',  3, 3, true,  true,  9,  470.00, 495.00, 510.00),

  -- Konaklamasız Paketler
  ('toren',      'Günübirlik (Sadece Tören)',       'konaklamasız', 1, 0, true,  false, 10, 55.00,  55.00,  55.00),
  ('gala',       'Gala',                            'konaklamasız', 1, 0, false, true,  11, 75.00,  75.00,  75.00),
  ('gala-toren', 'Günübirlik + Gala',               'konaklamasız', 1, 0, true,  true,  12, 130.00, 130.00, 130.00),

  -- Aile Odası Paketleri (+%10 Yetişkin Fiyatı, min 1 çocuk)
  ('aile-1g',    'Aile Odası • 1 Gece Konaklama',   'konaklamalı',  4, 1, true,  true,  13, 291.50, 319.00, 335.50),
  ('aile-2g',    'Aile Odası • 2 Gece Konaklama',   'konaklamalı',  4, 2, true,  true,  14, 396.00, 423.50, 440.00),
  ('aile-3g',    'Aile Odası • 3 Gece Konaklama',   'konaklamalı',  4, 3, true,  true,  15, 517.00, 544.50, 561.00)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "group" = EXCLUDED."group",
  capacity = EXCLUDED.capacity,
  nights = EXCLUDED.nights,
  ceremony = EXCLUDED.ceremony,
  gala = EXCLUDED.gala,
  sort_order = EXCLUDED.sort_order,
  early_bird_price = EXCLUDED.early_bird_price,
  round_1_price = EXCLUDED.round_1_price,
  round_2_price = EXCLUDED.round_2_price;

-- ------------------------------------------------------------------------------
-- 12. AKTİF KAYIT DÖNEMLERİ (pricing_periods SEED)
-- ------------------------------------------------------------------------------
-- Kayıt sisteminin "Kayıtlar kapanmıştır" hatası vermemesi için dönem aralıkları
INSERT INTO public.pricing_periods (id, label, starts_at, ends_at) VALUES
  ('early_bird', 'Erken Kayıt', '2026-01-01 00:00:00+03', '2027-01-15 23:59:59+03'),
  ('round_1',    '1. Dönem',    '2027-01-16 00:00:00+03', '2027-02-28 23:59:59+03'),
  ('round_2',    '2. Dönem',    '2027-03-01 00:00:00+03', '2027-04-05 23:59:59+03')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

-- ==============================================================================
-- KURULUM TAMAMLANDI!
-- ==============================================================================
