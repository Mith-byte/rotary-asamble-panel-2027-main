-- Migration 00013: Profil Güvenlik Trigger'ı Düzeltmesi (Admin API / Service Role Desteği)
-- Supabase SQL Editor üzerinden çalıştırın

-- Önceki trigger'ı ve fonksiyonu güncelle:
-- SECURITY DEFINER kaldırıldı (böylece PostgreSQL rolü doğru algılar)
-- Supabase PostgREST'in service_role anahtarıyla yaptığı istekleri (auth.role() = 'service_role' veya auth.uid() IS NULL) tam tanır
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

  -- Eğer istek Backend Admin Client (service_role), postgres veya supabase_admin tarafından yapılıyorsa
  -- veya auth.uid() boşsa (Service Role istemcisi kullanıcı taklidi yapmaz):
  -- Tüm güncellemelere (total_amount, status, role, pricing_type) izin ver.
  IF v_jwt_role = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin')
     OR coalesce(current_setting('role', true), '') IN ('service_role', 'postgres')
     OR auth.uid() IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- 2. Eğer istek tarayıcıdan doğrudan kullanıcı (authenticated) oturumuyla geliyorsa:
  -- Kullanıcının fiyatı, durumunu veya rolünü manipüle etmesini engelle:
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

-- Trigger'ı yeniden bağla
DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_fields();
