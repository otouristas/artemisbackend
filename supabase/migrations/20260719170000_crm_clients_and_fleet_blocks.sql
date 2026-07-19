-- CRM clients + fleet blocks (applied remotely)

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_document TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  preferred_language TEXT DEFAULT 'el',
  preferred_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS plate TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.vehicle_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artemis admin all clients" ON public.clients;
CREATE POLICY "Artemis admin all clients"
  ON public.clients FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());

DROP POLICY IF EXISTS "Artemis admin all vehicle_blocks" ON public.vehicle_blocks;
CREATE POLICY "Artemis admin all vehicle_blocks"
  ON public.vehicle_blocks FOR ALL TO authenticated
  USING (public.is_artemis_admin()) WITH CHECK (public.is_artemis_admin());
