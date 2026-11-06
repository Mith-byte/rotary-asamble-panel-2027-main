-- Migration 00015: Katılımcı T.C. Kimlik No ve Doğum Tarihi Alanları
-- profiles ve room_guests tablolarına tc_kimlik ve birth_date alanlarını ekler.

-- 1. profiles (Ana Katılımcı) tablosuna tc_kimlik ve birth_date ekle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tc_kimlik text,
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.profiles.tc_kimlik IS 'Ana katılımcının 11 haneli T.C. Kimlik Numarası';
COMMENT ON COLUMN public.profiles.birth_date IS 'Ana katılımcının Doğum Tarihi';

-- 2. room_guests (Oda Arkadaşı, 2. Yetişkin ve Çocuklar) tablosuna tc_kimlik ekle
-- Not: birth_date, email, phone kolonları 00010 numaralı migration ile zaten oluşturulmuştur.
ALTER TABLE public.room_guests
  ADD COLUMN IF NOT EXISTS tc_kimlik text;

COMMENT ON COLUMN public.room_guests.tc_kimlik IS 'Misafirin / katılımcının 11 haneli T.C. Kimlik Numarası';
