-- Per-model pricing by date range, public pricing and availability lookups for the website.
--
-- A vehicles row is one model (e.g. "Fiat Panda") with `quantity` units and their plates.
-- Prices belong to the model; availability is counted in units per day.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Link CRM models to website listings.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS show_on_site BOOLEAN NOT NULL DEFAULT true;

UPDATE public.vehicles
SET slug = trim(both '-' from regexp_replace(replace(lower(name), ' automatic', '-auto'), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_slug_key ON public.vehicles (slug) WHERE slug IS NOT NULL;

-- Daily rate for a model over an inclusive date range. Ranges for one model never overlap.
CREATE TABLE IF NOT EXISTS public.vehicle_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  label TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL CHECK (daily_rate > 0),
  min_days INTEGER NOT NULL DEFAULT 1 CHECK (min_days >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_rates_range_check CHECK (end_date >= start_date),
  CONSTRAINT vehicle_rates_no_overlap EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS vehicle_rates_vehicle_idx ON public.vehicle_rates (vehicle_id, start_date);

DROP TRIGGER IF EXISTS update_vehicle_rates_updated_at ON public.vehicle_rates;
CREATE TRIGGER update_vehicle_rates_updated_at
  BEFORE UPDATE ON public.vehicle_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vehicle_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artemis admin all vehicle_rates" ON public.vehicle_rates;
CREATE POLICY "Artemis admin all vehicle_rates"
  ON public.vehicle_rates FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

-- Seed: the published website prices, rest of 2026 and all of 2027. Skipped for any model
-- that already has rates, so re-running is safe.
INSERT INTO public.vehicle_rates (vehicle_id, label, start_date, end_date, daily_rate)
SELECT v.id, s.label, s.start_date, s.end_date, s.daily_rate
FROM (VALUES
  ('chevrolet-spark', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 40),
  ('chevrolet-spark', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 40),
  ('chevrolet-spark', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 45),
  ('chevrolet-spark', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 50),
  ('chevrolet-spark', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 65),
  ('chevrolet-spark', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 45),
  ('chevrolet-spark', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 40),
  ('chevrolet-spark', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 40),
  ('hyundai-i10', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 40),
  ('hyundai-i10', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 40),
  ('hyundai-i10', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 50),
  ('hyundai-i10', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 55),
  ('hyundai-i10', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 70),
  ('hyundai-i10', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 50),
  ('hyundai-i10', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 40),
  ('hyundai-i10', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 40),
  ('fiat-panda', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 45),
  ('fiat-panda', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 45),
  ('fiat-panda', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 55),
  ('fiat-panda', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 60),
  ('fiat-panda', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 75),
  ('fiat-panda', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 55),
  ('fiat-panda', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 45),
  ('fiat-panda', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 45),
  ('nissan-micra', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 45),
  ('nissan-micra', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 45),
  ('nissan-micra', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 55),
  ('nissan-micra', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 60),
  ('nissan-micra', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 75),
  ('nissan-micra', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 55),
  ('nissan-micra', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 45),
  ('nissan-micra', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 45),
  ('peugeot-208', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 50),
  ('peugeot-208', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 50),
  ('peugeot-208', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 60),
  ('peugeot-208', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 65),
  ('peugeot-208', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 80),
  ('peugeot-208', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 60),
  ('peugeot-208', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 50),
  ('peugeot-208', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 50),
  ('peugeot-208-auto', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 60),
  ('peugeot-208-auto', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 60),
  ('peugeot-208-auto', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 75),
  ('peugeot-208-auto', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 80),
  ('peugeot-208-auto', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 100),
  ('peugeot-208-auto', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 75),
  ('peugeot-208-auto', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 60),
  ('peugeot-208-auto', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 60),
  ('peugeot-301', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 55),
  ('peugeot-301', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 55),
  ('peugeot-301', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 65),
  ('peugeot-301', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 70),
  ('peugeot-301', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 85),
  ('peugeot-301', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 65),
  ('peugeot-301', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 55),
  ('peugeot-301', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 55),
  ('skoda-fabia', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 55),
  ('skoda-fabia', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 55),
  ('skoda-fabia', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 65),
  ('skoda-fabia', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 70),
  ('skoda-fabia', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 85),
  ('skoda-fabia', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 65),
  ('skoda-fabia', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 55),
  ('skoda-fabia', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 55),
  ('citroen-c3', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 55),
  ('citroen-c3', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 55),
  ('citroen-c3', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 65),
  ('citroen-c3', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 70),
  ('citroen-c3', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 85),
  ('citroen-c3', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 65),
  ('citroen-c3', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 55),
  ('citroen-c3', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 55),
  ('suzuki-ignis', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 50),
  ('suzuki-ignis', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 50),
  ('suzuki-ignis', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 65),
  ('suzuki-ignis', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 70),
  ('suzuki-ignis', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 85),
  ('suzuki-ignis', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 65),
  ('suzuki-ignis', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 50),
  ('suzuki-ignis', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 50),
  ('nissan-micra-auto', 'Χαμηλή περίοδος 2026', DATE '2026-11-01', DATE '2026-12-31', 50),
  ('nissan-micra-auto', 'Χαμηλή περίοδος 2027', DATE '2027-01-01', DATE '2027-05-10', 50),
  ('nissan-micra-auto', 'Ενδιάμεση περίοδος 2027', DATE '2027-05-11', DATE '2027-06-10', 65),
  ('nissan-micra-auto', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 70),
  ('nissan-micra-auto', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 85),
  ('nissan-micra-auto', 'Ενδιάμεση περίοδος 2027', DATE '2027-09-11', DATE '2027-09-30', 65),
  ('nissan-micra-auto', 'Χαμηλή περίοδος 2027', DATE '2027-10-01', DATE '2027-10-31', 50),
  ('nissan-micra-auto', 'Χαμηλή περίοδος 2027', DATE '2027-11-01', DATE '2027-12-31', 50),
  ('sym-symphony-125', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 30),
  ('sym-symphony-125', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 35),
  ('sym-symphony-150', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 30),
  ('sym-symphony-150', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 35),
  ('sym-symphony-200', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 35),
  ('sym-symphony-200', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 40),
  ('fiddle-125', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 30),
  ('fiddle-125', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 35),
  ('jet4-125', 'Μεσαία περίοδος 2027', DATE '2027-06-11', DATE '2027-07-10', 30),
  ('jet4-125', 'Υψηλή περίοδος 2027', DATE '2027-07-11', DATE '2027-09-10', 35)
) AS s (slug, label, start_date, end_date, daily_rate)
JOIN public.vehicles v ON v.slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM public.vehicle_rates r WHERE r.vehicle_id = v.id);

-- Public pricing for the website. Only models shown on the site; no customer data.
CREATE OR REPLACE FUNCTION public.site_vehicle_pricing()
RETURNS TABLE (slug TEXT, label TEXT, start_date DATE, end_date DATE, daily_rate NUMERIC, min_days INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.slug, r.label, r.start_date, r.end_date, r.daily_rate, r.min_days
  FROM public.vehicle_rates r
  JOIN public.vehicles v ON v.id = r.vehicle_id
  WHERE v.slug IS NOT NULL AND v.active AND v.show_on_site AND r.end_date >= current_date
  ORDER BY v.slug, r.start_date;
$$;

-- Free units per model per day. A booking (pending or confirmed) holds one unit from
-- check-in through the return day inclusive; each maintenance block holds one unit.
-- Returns counts only. Range is capped at 400 days.
CREATE OR REPLACE FUNCTION public.site_vehicle_availability(p_from DATE, p_to DATE)
RETURNS TABLE (slug TEXT, day DATE, units_total INTEGER, units_free INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT d::date AS day
    FROM generate_series(
      greatest(p_from, current_date),
      least(p_to, greatest(p_from, current_date) + 400),
      interval '1 day'
    ) AS d
  )
  SELECT
    v.slug,
    days.day,
    v.quantity AS units_total,
    greatest(
      v.quantity
        - (SELECT count(*) FROM public.bookings b
           WHERE b.vehicle_id = v.id
             AND b.status IN ('pending', 'confirmed')
             AND days.day BETWEEN b.check_in AND b.check_out)
        - (SELECT count(*) FROM public.vehicle_blocks k
           WHERE k.vehicle_id = v.id
             AND days.day BETWEEN k.start_date AND k.end_date),
      0
    )::int AS units_free
  FROM public.vehicles v
  CROSS JOIN days
  WHERE v.slug IS NOT NULL AND v.active AND v.show_on_site
  ORDER BY v.slug, days.day;
$$;

REVOKE ALL ON FUNCTION public.site_vehicle_pricing() FROM public;
REVOKE ALL ON FUNCTION public.site_vehicle_availability(DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.site_vehicle_pricing() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.site_vehicle_availability(DATE, DATE) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS bookings_vehicle_dates_idx ON public.bookings (vehicle_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS vehicle_blocks_vehicle_dates_idx ON public.vehicle_blocks (vehicle_id, start_date, end_date);

-- Live updates in the CRM for the tables that change availability and price.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'vehicle_blocks', 'vehicles', 'vehicle_rates'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
