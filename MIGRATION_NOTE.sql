-- MIGRATION NOTE: Remove Installments and Dekont
-- 
-- The following SQL commands should be run in Supabase SQL Editor
-- to clean up the unused tables and columns related to manual installments and dekont logic.

-- 1. Drop the installments table
DROP TABLE IF EXISTS public.installments;

-- 2. Remove the dekont_url column from profiles
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS dekont_url;

-- Note: The status field on profiles remains, and has values ('waiting', 'accepted').
-- No changes needed for profile status column itself.
