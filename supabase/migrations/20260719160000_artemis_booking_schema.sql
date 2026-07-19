-- Artemis booking schema (car | scooter) + admin-only RLS
-- Applied to project ogbjgmxmlmgpcsdmrkcq

CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE public.vehicle_type AS ENUM ('car', 'scooter');
CREATE TYPE public.checklist_type AS ENUM ('check_in', 'check_out');

CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type public.vehicle_type NOT NULL,
  cc INTEGER NOT NULL,
  image_url TEXT,
  daily_rate_low NUMERIC(10,2) NOT NULL,
  daily_rate_high NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  comments TEXT,
  payment_notes TEXT,
  status public.booking_status NOT NULL DEFAULT 'pending',
  delivery_location TEXT,
  deposit_amount NUMERIC DEFAULT 0,
  id_document TEXT,
  booking_source TEXT DEFAULT 'phone',
  total_price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type checklist_type NOT NULL,
  fuel_level INTEGER DEFAULT 100 CHECK (fuel_level >= 0 AND fuel_level <= 100),
  mileage INTEGER DEFAULT 0,
  damage_notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_artemis_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt()->>'email', '') = 'info@artemisrental.gr';
$$;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artemis admin all vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

CREATE POLICY "Artemis admin all bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

CREATE POLICY "Artemis admin all checklists"
  ON public.vehicle_checklists FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Artemis admin upload vehicle photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos' AND public.is_artemis_admin());

CREATE POLICY "Artemis admin update vehicle photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.is_artemis_admin())
  WITH CHECK (bucket_id = 'vehicle-photos' AND public.is_artemis_admin());

CREATE POLICY "Artemis admin delete vehicle photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.is_artemis_admin());

CREATE POLICY "Public read vehicle photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'vehicle-photos');

INSERT INTO public.vehicles (name, type, cc, daily_rate_low, daily_rate_high, image_url) VALUES
  ('Skoda Fabia', 'car', 1000, 55, 85, 'https://rentacarsifnos.com/images/fleet/scoda-fabia.jpg'),
  ('Fiat Panda', 'car', 1200, 45, 75, 'https://rentacarsifnos.com/images/fleet/fiat-panda.jpg'),
  ('Suzuki Ignis', 'car', 1200, 50, 85, 'https://rentacarsifnos.com/images/fleet/suzuki-ignis.jpg'),
  ('Peugeot 208', 'car', 1200, 50, 80, 'https://rentacarsifnos.com/images/fleet/peugeot-208.jpg'),
  ('Peugeot 208 Automatic', 'car', 1200, 60, 100, 'https://rentacarsifnos.com/images/fleet/peugeot-208.jpg'),
  ('Nissan Micra', 'car', 1200, 45, 75, 'https://rentacarsifnos.com/images/fleet/nissan-micra.jpg'),
  ('Nissan Micra Automatic', 'car', 1200, 50, 85, 'https://rentacarsifnos.com/images/fleet/nissan-micra.jpg'),
  ('Chevrolet Spark', 'car', 1000, 40, 65, 'https://rentacarsifnos.com/images/fleet/chevrolet-spark.jpg'),
  ('Hyundai i10', 'car', 1200, 40, 70, 'https://rentacarsifnos.com/images/fleet/hyundai-i10.jpg'),
  ('Peugeot 301', 'car', 1200, 55, 85, 'https://rentacarsifnos.com/images/fleet/peugeot-301.jpg'),
  ('Citroen C3', 'car', 1200, 55, 85, 'https://rentacarsifnos.com/images/fleet/citroen-c3.jpg'),
  ('SYM Symphony 125', 'scooter', 125, 30, 35, 'https://rentacarsifnos.com/images/fleet/SYM-Symphony-125.jpg'),
  ('SYM Symphony 150', 'scooter', 150, 30, 35, 'https://rentacarsifnos.com/images/fleet/SYM-Symphony-150.jpg'),
  ('SYM Symphony 200', 'scooter', 200, 35, 40, 'https://rentacarsifnos.com/images/fleet/SYM-Symphony-200.jpg'),
  ('Fiddle 125', 'scooter', 125, 30, 35, 'https://rentacarsifnos.com/images/fleet/fiddle-125.jpg'),
  ('JET4 125', 'scooter', 125, 30, 35, 'https://rentacarsifnos.com/images/fleet/JET4-125.jpg');
