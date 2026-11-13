-- Migration 00019: twinvision.verdapulse@gmail.com adresini Admin olarak yetkilendirme
-- Supabase SQL Editor üzerinden çalıştırabilirsiniz.

-- 1. Var olan kullanıcı varsa auth.users tablosundaki metadata'yı admin yap:
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE LOWER(email) = 'twinvision.verdapulse@gmail.com';

-- 2. Var olan profil varsa public.profiles tablosunda rolü admin yap ve profil bilgilerini tamamla:
UPDATE public.profiles
SET 
  role = 'admin',
  status = 'accepted',
  first_name = COALESCE(NULLIF(first_name, ''), 'Sistem'),
  last_name = COALESCE(NULLIF(last_name, ''), 'Yöneticisi')
WHERE LOWER(email) = 'twinvision.verdapulse@gmail.com';

-- 3. Gelecekte veya ilk kez giriş yapıldığında otomatik admin profili oluşturan trigger'ı güncelle:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := (
    LOWER(new.email) = 'twinvision.verdapulse@gmail.com' 
    OR (new.raw_user_meta_data ->> 'role') = 'admin'
  );

  INSERT INTO public.profiles (
    id,
    email,
    role,
    status,
    first_name,
    last_name
  )
  VALUES (
    new.id,
    new.email,
    CASE WHEN v_is_admin THEN 'admin'::public.user_role ELSE 'user'::public.user_role END,
    CASE WHEN v_is_admin THEN 'accepted'::public.user_status ELSE 'waiting'::public.user_status END,
    CASE WHEN v_is_admin THEN COALESCE(NULLIF(new.raw_user_meta_data ->> 'first_name', ''), 'Sistem') ELSE NULL END,
    CASE WHEN v_is_admin THEN COALESCE(NULLIF(new.raw_user_meta_data ->> 'last_name', ''), 'Yöneticisi') ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN v_is_admin THEN 'admin'::public.user_role ELSE public.profiles.role END,
    status = CASE WHEN v_is_admin THEN 'accepted'::public.user_status ELSE public.profiles.status END,
    email = EXCLUDED.email;

  RETURN new;
END;
$$;
