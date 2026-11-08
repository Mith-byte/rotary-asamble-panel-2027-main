-- Migration 00016: 3 Kişilik Konaklamalı Paketler ve Fiyat Tanımları
-- 3 kişilik odaları '3 Kişi • X Gece Konaklama' olarak güncelle ve dönem fiyatlarını doğrula

-- 1 Gece 3 Kişilik Oda: Erken 265 €, 1. Dönem 290 €, 2. Dönem 305 €
UPDATE public.packages
SET
  name = '3 Kişi • 1 Gece Konaklama',
  early_bird_price = 265,
  round_1_price = 290,
  round_2_price = 305
WHERE id = '3k-1g';

-- 2 Gece 3 Kişilik Oda: Erken 360 €, 1. Dönem 385 €, 2. Dönem 400 €
UPDATE public.packages
SET
  name = '3 Kişi • 2 Gece Konaklama',
  early_bird_price = 360,
  round_1_price = 385,
  round_2_price = 400
WHERE id = '3k-2g';

-- 3 Gece 3 Kişilik Oda: Erken 470 €, 1. Dönem 495 €, 2. Dönem 510 €
UPDATE public.packages
SET
  name = '3 Kişi • 3 Gece Konaklama',
  early_bird_price = 470,
  round_1_price = 495,
  round_2_price = 510
WHERE id = '3k-3g';
