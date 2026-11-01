-- Migration 00012: Güvenlik Sıkılaştırma, KVKK Veri Gizliliği, Yetki Yükseltme ve Concurrency Koruması
-- Supabase SQL Editor üzerinden çalıştırılabilir (Idempotent)

-- 1. KVKK / VERİ GİZLİLİĞİ: room_guests Tablosunda Veri İfşasını (Data Leakage) Kapat
-- Eski açık politikayı kaldır
DROP POLICY IF EXISTS "Anyone authenticated can view room guests" ON public.room_guests;
DROP POLICY IF EXISTS "Users can only view own or roommate guests" ON public.room_guests;

-- Yeni Güvenli Politika: Katılımcı SADECE kendi eklediği misafirleri veya kendi kaldığı odadaki misafirleri görebilir.
CREATE POLICY "Users can only view own or roommate guests"
  ON public.room_guests FOR SELECT
  USING (
    auth.uid() = registered_by
    OR room_id IN (
      SELECT p.room_id FROM public.profiles p WHERE p.id = auth.uid() AND p.room_id IS NOT NULL
    )
  );

-- 2. YETKİ YÜKSELTME KORUMASI (Privilege Escalation Defense):
-- profiles tablosunda normal kullanıcıların role='admin', status='accepted' veya total_amount manipülasyonunu engelle
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_jwt_role text;
BEGIN
  -- 1. Service role veya veritabanı yöneticisi kontrolü
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

  -- Normal kullanıcılar (authenticated) kritik alanları manipüle edemez
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

-- 3. RACE CONDITION VE KAPASİTE ÇAKIŞMASI KORUMASI (Concurrency Defense)
-- Kalan kapasitenin 0'ın altına düşmesini veritabanı seviyesinde fiziksel olarak engelle
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_remaining_capacity_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_remaining_capacity_check CHECK (remaining_capacity >= 0);

-- Eşzamanlı (Concurrent) isteklerde çakışmayı önleyen Satır Kilitlemeli (Row-Level Locking) RPC fonksiyonu
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
  -- FOR UPDATE kilidi ile bu odaya gelen tüm paralel işlemler sıraya dizilir
  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı');
  END IF;

  -- Kapasite kontrolü
  IF v_room.remaining_capacity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda kapasitesi dolu');
  END IF;

  -- Kalan kapasiteyi 1 azalt
  UPDATE public.rooms
  SET remaining_capacity = remaining_capacity - 1,
      updated_at = now()
  WHERE id = p_room_id;

  -- Kullanıcı profilini odaya ata
  UPDATE public.profiles
  SET room_id = p_room_id,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'remaining_capacity', v_room.remaining_capacity - 1);
END;
$$;
