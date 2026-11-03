-- Remote push for new website booking requests.
--
-- device_tokens: APNs tokens of the Artemis CRM iPhones (written by the app, admin only).
-- booking_requests.push_sent_at: set once by the push function, so a request is pushed at most once.
-- Trigger: after each insert, pg_net calls the push-new-request edge function with the request id only.
-- The function re-reads the request itself, so the call carries no data and needs no shared secret.

create extension if not exists pg_net;

create table if not exists public.device_tokens (
  token        text primary key,
  platform     text not null default 'ios',
  bundle_id    text not null default 'gr.artemisrental.crm',
  environment  text not null default 'production' check (environment in ('development', 'production')),
  device_name  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.device_tokens enable row level security;

drop policy if exists "Artemis admin all device_tokens" on public.device_tokens;
create policy "Artemis admin all device_tokens"
  on public.device_tokens for all to authenticated
  using (public.is_artemis_admin()) with check (public.is_artemis_admin());

drop trigger if exists update_device_tokens_updated_at on public.device_tokens;
create trigger update_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.update_updated_at_column();

alter table public.booking_requests add column if not exists push_sent_at timestamptz;

create or replace function public.notify_new_booking_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ogbjgmxmlmgpcsdmrkcq.supabase.co/functions/v1/push-new-request',
    body := jsonb_build_object('request_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- A push problem must never block a booking request from being saved.
  return new;
end;
$$;

drop trigger if exists booking_requests_push on public.booking_requests;
create trigger booking_requests_push
  after insert on public.booking_requests
  for each row execute function public.notify_new_booking_request();
