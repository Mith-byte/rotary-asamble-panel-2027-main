-- Migration 00017: Aile Odası Paketleri ve Fiyat Tanımları
-- Aile Odası (2 Yetişkin + Zorunlu 1 Çocuk + Opsiyonel 1 Çocuk)
-- Fiyatlar 3 kişilik odadaki yetişkin fiyatlarından %10 daha pahalıdır.
-- 3 Kişilik Oda: 1g: 265 €, 2g: 360 €, 3g: 470 €
-- Aile Odası (+%10):
-- 1 Gece (aile-1g): Erken 291.50 €, 1. Dönem 319.00 €, 2. Dönem 335.50 €
-- 2 Gece (aile-2g): Erken 396.00 €, 1. Dönem 423.50 €, 2. Dönem 440.00 €
-- 3 Gece (aile-3g): Erken 517.00 €, 1. Dönem 544.50 €, 2. Dönem 561.00 €

-- 1. packages tablosundaki ID ve capacity kısıtlarını güncelle
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_id_check;
ALTER TABLE public.packages ADD CONSTRAINT packages_id_check CHECK (id IN (
  '1k-3g', '2k-3g', '3k-3g',
  '1k-2g', '2k-2g', '3k-2g',
  '1k-1g', '2k-1g', '3k-1g',
  'aile-1g', 'aile-2g', 'aile-3g',
  'gala-toren', 'toren', 'gala'
));

ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_capacity_check;
ALTER TABLE public.packages ADD CONSTRAINT packages_capacity_check CHECK (capacity BETWEEN 1 AND 6);

-- 2. Aile Odası paketlerini ekle / güncelle
INSERT INTO public.packages (
  id, name, "group", capacity, nights, ceremony, gala, sort_order,
  early_bird_price, round_1_price, round_2_price
) VALUES
  ('aile-1g', 'Aile Odası • 1 Gece Konaklama', 'konaklamalı', 4, 1, true, true, 13, 291.50, 319.00, 335.50),
  ('aile-2g', 'Aile Odası • 2 Gece Konaklama', 'konaklamalı', 4, 2, true, true, 14, 396.00, 423.50, 440.00),
  ('aile-3g', 'Aile Odası • 3 Gece Konaklama', 'konaklamalı', 4, 3, true, true, 15, 517.00, 544.50, 561.00)
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
