-- Migration 00010: Oda Kapasite Yönetimi, Aile Odası ve Misafir Tablosu
-- Çalıştırma: Supabase SQL Editor (Tekrar çalıştırılabilir / Idempotent)

-- 1. rooms tablosuna kalan kapasite ve oda tipi kolonlarını ekle, kapasite kısıtını güncelle
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS remaining_capacity integer NOT NULL DEFAULT 0;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_type text DEFAULT 'standard';

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_capacity_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_capacity_check CHECK (capacity BETWEEN 1 AND 6);

-- 2. profiles tablosuna toplam hesaplanan tutar ve oda arkadaşı bilgisi ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_roommate boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guest_count integer DEFAULT 0;

-- 3. Oda arkadaşı ve çocuk (aile) misafirlerini tutacak room_guests tablosu
CREATE TABLE IF NOT EXISTS public.room_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  registered_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_type text NOT NULL CHECK (guest_type IN ('adult', 'child')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  gender text CHECK (gender IS NULL OR gender IN ('Erkek', 'Kadın')),
  club text,
  birth_date date,
  age integer,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_room_guests_room_id ON public.room_guests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_guests_registered_by ON public.room_guests(registered_by);

-- RLS Politikaları (Önce varsa silinir, sonra tekrar eklenir - Idempotent)
ALTER TABLE public.room_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view room guests" ON public.room_guests;
CREATE POLICY "Anyone authenticated can view room guests"
  ON public.room_guests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own room guests" ON public.room_guests;
CREATE POLICY "Users can manage own room guests"
  ON public.room_guests FOR ALL
  USING (auth.uid() = registered_by)
  WITH CHECK (auth.uid() = registered_by);

-- 4. 3 Kişilik Odaların İsimlerini 'Aile Odası' olarak güncelle
UPDATE public.packages SET name = 'Aile Odası • 1 Gece Konaklama' WHERE id = '3k-1g';
UPDATE public.packages SET name = 'Aile Odası • 2 Gece Konaklama' WHERE id = '3k-2g';
UPDATE public.packages SET name = 'Aile Odası • 3 Gece Konaklama' WHERE id = '3k-3g';

-- 5. Para birimini varsayılan olarak EUR yap
ALTER TABLE public.payment_transactions ALTER COLUMN currency SET DEFAULT 'EUR';
UPDATE public.payment_transactions SET currency = 'EUR' WHERE currency = 'TRY';
