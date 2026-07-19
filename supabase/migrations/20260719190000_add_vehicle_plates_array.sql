-- Migration: replace single plate TEXT with plates TEXT[] to support multiple units per fleet type
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS plates TEXT[] DEFAULT NULL;

-- Migrate existing plate value into the new array (first slot)
UPDATE public.vehicles SET plates = ARRAY[plate] WHERE plate IS NOT NULL AND plates IS NULL;
