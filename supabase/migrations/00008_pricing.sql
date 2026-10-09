-- DÜZELTME v2 — Tüm adımlar baştan dahil
-- Supabase Dashboard > SQL Editor'da çalıştırın.

-- 1. Fiyat kolonlarını numeric'e çevir (zaten yapıldıysa hata vermez)
ALTER TABLE public.packages
  ALTER COLUMN early_bird_price TYPE numeric(10,2) USING early_bird_price::numeric,
  ALTER COLUMN early_bird_installment_price TYPE numeric(10,2) USING early_bird_installment_price::numeric,
  ALTER COLUMN round_1_price TYPE numeric(10,2) USING round_1_price::numeric,
  ALTER COLUMN round_1_installment_price TYPE numeric(10,2) USING round_1_installment_price::numeric,
  ALTER COLUMN round_2_price TYPE numeric(10,2) USING round_2_price::numeric,
  ALTER COLUMN round_2_installment_price TYPE numeric(10,2) USING round_2_installment_price::numeric;

-- 2. ID kısıtını yeni paketleri kapsayacak şekilde güncelle
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_id_check;
ALTER TABLE public.packages ADD CONSTRAINT packages_id_check CHECK (id IN (
  '1k-3g', '2k-3g', '3k-3g',
  '1k-2g', '2k-2g', '3k-2g',
  '1k-1g', '2k-1g', '3k-1g',
  'gala-toren', 'toren', 'gala'
));

-- 3. Mevcut sort_order'ları geçici olarak kaydır (unique çakışmasını önlemek için)
UPDATE public.packages SET sort_order = sort_order + 100;

-- 4. 1 Gece paketlerini ekle (varsa atla)
INSERT INTO public.packages (id, name, "group", capacity, nights, ceremony, gala, sort_order) VALUES
  ('1k-1g', '1 Kişi • 1 Gece Konaklama', 'konaklamalı', 1, 1, true, true, 201),
  ('2k-1g', '2 Kişi • 1 Gece Konaklama', 'konaklamalı', 2, 1, true, true, 202),
  ('3k-1g', '3 Kişi • 1 Gece Konaklama', 'konaklamalı', 3, 1, true, true, 203)
ON CONFLICT (id) DO NOTHING;

-- 5. Tüm sort_order'ları doğru sıraya getir
UPDATE public.packages SET sort_order = 1  WHERE id = '1k-1g';
UPDATE public.packages SET sort_order = 2  WHERE id = '2k-1g';
UPDATE public.packages SET sort_order = 3  WHERE id = '3k-1g';
UPDATE public.packages SET sort_order = 4  WHERE id = '1k-2g';
UPDATE public.packages SET sort_order = 5  WHERE id = '2k-2g';
UPDATE public.packages SET sort_order = 6  WHERE id = '3k-2g';
UPDATE public.packages SET sort_order = 7  WHERE id = '1k-3g';
UPDATE public.packages SET sort_order = 8  WHERE id = '2k-3g';
UPDATE public.packages SET sort_order = 9  WHERE id = '3k-3g';
UPDATE public.packages SET sort_order = 10 WHERE id = 'gala-toren';
UPDATE public.packages SET sort_order = 11 WHERE id = 'toren';
UPDATE public.packages SET sort_order = 12 WHERE id = 'gala';

-- 6. Tüm fiyatları işle (€ cinsinden)

-- 1 GECE
UPDATE public.packages SET
  early_bird_price = 350, round_1_price = 375, round_2_price = 395
WHERE id = '1k-1g';

UPDATE public.packages SET
  early_bird_price = 275, round_1_price = 300, round_2_price = 315
WHERE id = '2k-1g';

UPDATE public.packages SET
  early_bird_price = 265, round_1_price = 290, round_2_price = 305
WHERE id = '3k-1g';

-- 2 GECE
UPDATE public.packages SET
  early_bird_price = 525, round_1_price = 550, round_2_price = 575
WHERE id = '1k-2g';

UPDATE public.packages SET
  early_bird_price = 380, round_1_price = 405, round_2_price = 420
WHERE id = '2k-2g';

UPDATE public.packages SET
  early_bird_price = 360, round_1_price = 385, round_2_price = 400
WHERE id = '3k-2g';

-- 3 GECE
UPDATE public.packages SET
  early_bird_price = 700, round_1_price = 725, round_2_price = 750
WHERE id = '1k-3g';

UPDATE public.packages SET
  early_bird_price = 500, round_1_price = 525, round_2_price = 540
WHERE id = '2k-3g';

UPDATE public.packages SET
  early_bird_price = 470, round_1_price = 495, round_2_price = 510
WHERE id = '3k-3g';
