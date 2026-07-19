-- Add payment_method and extra_fees_json to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS extra_fees_json TEXT DEFAULT NULL;
