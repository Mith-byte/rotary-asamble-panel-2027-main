-- Migration 00011: İş Bankası Ödeme Durumları Desteği
-- payment_status enum'ına 'paid' ve 'success' durumlarını ekler (varsa atlar)
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'success';
