-- Migration: 00009_add_missing_packages.sql
-- Konaklamasız paketlerin eklenmesi / güncellenmesi
-- 1. Günübirlik (Sadece Tören): 55 Euro
-- 2. Gala: 75 Euro
-- 3. Günübirlik + Gala: 130 Euro

-- 1. ID kısıtını kontrol et ve geçerli paket listesine uygun olduğundan emin ol
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_id_check;
ALTER TABLE public.packages ADD CONSTRAINT packages_id_check CHECK (id IN (
  '1k-3g', '2k-3g', '3k-3g',
  '1k-2g', '2k-2g', '3k-2g',
  '1k-1g', '2k-1g', '3k-1g',
  'gala-toren', 'toren', 'gala'
));

-- 2. Konaklamasız paketleri ekle veya mevcut olanların isim ve fiyatlarını güncelle
INSERT INTO public.packages (
  id,
  name,
  "group",
  capacity,
  nights,
  ceremony,
  gala,
  sort_order,
  early_bird_price,
  round_1_price,
  round_2_price
) VALUES
  ('toren', 'Günübirlik (Sadece Tören)', 'konaklamasız', 1, 0, true, false, 110, 55, 55, 55),
  ('gala', 'Gala', 'konaklamasız', 1, 0, false, true, 111, 75, 75, 75),
  ('gala-toren', 'Günübirlik + Gala', 'konaklamasız', 1, 0, true, true, 112, 130, 130, 130)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "group" = EXCLUDED."group",
  capacity = EXCLUDED.capacity,
  nights = EXCLUDED.nights,
  ceremony = EXCLUDED.ceremony,
  gala = EXCLUDED.gala,
  early_bird_price = EXCLUDED.early_bird_price,
  round_1_price = EXCLUDED.round_1_price,
  round_2_price = EXCLUDED.round_2_price;

-- 3. Sıralama (sort_order) çakışmasını önlemek için geçici kaydırma ardından kesin sıralama
UPDATE public.packages SET sort_order = 110 WHERE id = 'toren';
UPDATE public.packages SET sort_order = 111 WHERE id = 'gala';
UPDATE public.packages SET sort_order = 112 WHERE id = 'gala-toren';

UPDATE public.packages SET sort_order = 10 WHERE id = 'toren';
UPDATE public.packages SET sort_order = 11 WHERE id = 'gala';
UPDATE public.packages SET sort_order = 12 WHERE id = 'gala-toren';
