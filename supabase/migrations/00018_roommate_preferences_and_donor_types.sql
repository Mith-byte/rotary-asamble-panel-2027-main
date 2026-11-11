-- Migration 00018: Oda Arkadaşı Tercihleri ve Bağışçı Türü (Donor Types)
-- 1. profiles tablosuna bağışçı türü, oda kayıt tipi ve oda arkadaşı tercihleri kolonlarını ekle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS donor_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS room_registration_type text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS roommate_preference_1 text,
  ADD COLUMN IF NOT EXISTS roommate_preference_2 text;

COMMENT ON COLUMN public.profiles.donor_types IS 'Bağışçı Türleri (Paul Harris Dostu, Benefactor, Major Donor)';
COMMENT ON COLUMN public.profiles.room_registration_type IS 'Konaklama kayıt tipi: individual (Bireysel) veya room (Tüm Odayı Kapat)';
COMMENT ON COLUMN public.profiles.roommate_preference_1 IS 'Bireysel kayıtta 1. tercih edilen oda arkadaşı adı soyadı';
COMMENT ON COLUMN public.profiles.roommate_preference_2 IS 'Bireysel kayıtta 2. tercih edilen oda arkadaşı adı soyadı (3 kişilik odalar için)';

-- 2. room_guests tablosuna yetişkin misafirler için bağışçı türü kolonunu ekle
ALTER TABLE public.room_guests
  ADD COLUMN IF NOT EXISTS donor_types text[] DEFAULT '{}';

COMMENT ON COLUMN public.room_guests.donor_types IS 'Yetişkin misafirin bağışçı türleri';
