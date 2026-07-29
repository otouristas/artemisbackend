-- Booking requests inbox (website / Touristas / manual leads)
-- Separate from bookings until staff accepts and assigns a fleet unit

CREATE TYPE public.request_status AS ENUM ('new', 'reviewed', 'accepted', 'rejected');

CREATE TABLE public.booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  requested_vehicle TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  pickup_location TEXT,
  return_location TEXT,
  child_seat BOOLEAN NOT NULL DEFAULT false,
  party_size INTEGER,
  arrival_info TEXT,
  message TEXT,
  estimated_total NUMERIC(10,2),
  locale TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  admin_notes TEXT,
  status public.request_status NOT NULL DEFAULT 'new',
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX booking_requests_status_idx ON public.booking_requests (status);
CREATE INDEX booking_requests_created_at_idx ON public.booking_requests (created_at DESC);

CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Admin CRM: full access
CREATE POLICY "Artemis admin all booking_requests"
  ON public.booking_requests FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

-- Public/anon: no access (website inserts use service role, which bypasses RLS)

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests;
