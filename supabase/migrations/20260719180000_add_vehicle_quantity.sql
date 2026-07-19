-- Migration to add quantity column to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1);
