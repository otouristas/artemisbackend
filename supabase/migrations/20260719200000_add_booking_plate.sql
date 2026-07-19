-- Migration to add assigned unit plate to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS plate TEXT;
