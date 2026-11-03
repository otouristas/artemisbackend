# Artemis CRM for iOS

The native iPhone back office for Artemis Rental (Σίφνος). It uses the same Supabase project, the same
login (`info@artemisrental.gr`) and the same row-level security as the web CRM in this repo, and the
same business rules (status labels, WhatsApp messages, nightly pricing from `vehicle_rates`).

SwiftUI, iOS 17+, Swift 5 language mode, `supabase-swift` 2.x via Swift Package Manager. The UI is in Greek.

| Tab | What it does |
| --- | --- |
| **Σήμερα** | Date header, KPIs (αφίξεις, αναχωρήσεις, εκκρεμείς, ανοιχτά υπόλοιπα), today's pickups and returns as trip cards with call and WhatsApp buttons, a callout for new website requests, and the next 7 days. |
| **Κρατήσεις** | Επερχόμενες / Σε ενοικίαση / Ιστορικό tabs, grouped by day, search, swipe (confirm, WhatsApp, call, cancel), context menus. Booking detail shows the trip, the customer, payment (total, deposit, balance) and confirm/cancel. The form creates and edits bookings. It shows the free units per model for the chosen dates, a plate picker that marks plates already taken, the client (existing, or created on save like the web), and an automatic price from `vehicle_rates` that you can override. |
| **Αιτήματα** | Website requests. Νέα / Ελεγμένα / Αποδεκτά / Απορριφθέντα / Όλα, with a badge on the tab showing how many are new. The detail shows the trip, the guest's message, contact buttons, and availability (free units, clashing bookings, alternative models). **Αποδοχή** opens the booking form pre-filled. Saving creates the booking and sets the request to `accepted` with its `booking_id`. You can also reject a request or mark it reviewed. |
| **Στόλος** | Model cards with photo, units free today (x/y) and today's price. Model detail shows units and plates (busy or free today), a 14-day availability strip, upcoming bookings, and the price periods. You can add, edit or delete periods in the app; overlaps are rejected, as in the database. |
| **Περισσότερα** | Πελάτες (search, history, totals), Οικονομικά (season total, collected vs open, monthly Swift Charts bars, payment methods, open balances), Ρυθμίσεις (notification status and toggle, test notification, background/push status, sign out, version). |

Availability follows `public.site_vehicle_availability()`. A pending or confirmed booking holds one unit
from check-in through the return day **inclusive**, and each `vehicle_blocks` row holds one unit. Price is
the sum of the nightly rates, with nights = check_out − check_in, as in `src/lib/ratePricing.ts`.

## Build & run

Requirements: Xcode 16 or later (tested with Xcode 27.2) and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).

```sh
cd ios
xcodegen generate            # creates ArtemisCRM.xcodeproj from project.yml
open ArtemisCRM.xcodeproj    # Run on a simulator or a device
```

Or from the command line:

```sh
scripts/run-demo.sh -DemoMode          # build, install and launch on "iPhone 18 Pro Max"
SIM_DEVICE="iPhone 17" scripts/run-demo.sh
```

To run on your own iPhone, select the **ArtemisCRM** target › Signing & Capabilities and choose your team.
The bundle id is `gr.artemisrental.crm`. A normal launch shows the login screen. The session is kept in
the Keychain (the SDK default) and refreshed automatically, so you sign in once.

## Demo mode (DEBUG only)

The launch argument `-DemoMode` skips login and loads realistic sample data in memory. It has 16 models
(Chevrolet Spark ×8, Fiat Panda ×5, SYM Symphony 125 ×7, …), about 30 bookings this week and next month,
a season of history for the charts, 16 clients, 3 new website requests and a few older ones. Every write
works on that in-memory data, so you can try the flows (accept a request, edit a booking, edit prices).
Nothing reaches Supabase. Demo mode is compiled out of Release builds.

In Xcode: Product › Scheme › Edit Scheme › Run › Arguments, and tick `-DemoMode`.

Extra DEBUG arguments:

* `-DemoSimulateRequest` makes a new website request "arrive" 4 seconds after launch. Use it to see the in-app banner, the local notification and the tab badge.
* `-DemoRoute <route>` opens a screen directly, for screenshots: `today`, `today/new`, `bookings`, `bookings/detail`, `requests`, `requests/detail`, `requests/accept`, `fleet`, `fleet/detail`, `more`, `more/clients`, `more/client`, `more/money`, `more/settings`.

`scripts/screenshots.sh` captures every screen in light and dark mode into `screenshots/`. It needs a
booted simulator with the app installed, and notifications allowed once.

## Notifications

1. **Permission**: the app asks right after login.
2. **While the app is running**: a Supabase Realtime subscription on `booking_requests` INSERT posts a local notification ("Νέο αίτημα κράτησης: name, vehicle, dates"), shows an in-app banner and updates the tab badge. Realtime also refreshes the data when bookings, vehicles, rates, clients or blocks change. `booking_requests` is already in the `supabase_realtime` publication (migration `20260729160000`).
3. **In the background**: a `BGAppRefreshTask` (`gr.artemisrental.crm.refresh`) fetches requests created since the last one seen, posts a local notification for each new one, and sets the app icon badge to the number of `new` requests. iOS decides when it runs, typically every 15 minutes to a few hours depending on usage. Background App Refresh must be on for the app. To trigger it in the debugger, run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"gr.artemisrental.crm.refresh"]`.
4. **Tapping a notification** opens that request. The payload key is `request_id`. Deep links work too: `artemiscrm://request/<uuid>` and `artemiscrm://booking/<uuid>`.

With only steps 2–3, nothing is guaranteed to arrive while the app is fully closed: iOS does not run
background refresh for an app the user force-quit. For instant alerts at all times, set up remote push.

## Remote push (when the app is closed)

Everything on the app side is ready behind a flag. When `ArtemisRemotePushEnabled` is on and permission
is granted, the app registers with APNs and saves its device token to `public.device_tokens`. The ready
edge function `supabase/functions/push-new-request` sends the push. Nothing has been applied to the
database or deployed.

### What the owner needs to provide

1. **Apple Developer Program membership** (paid, €99/year). It is needed for push, TestFlight and the App Store.
2. **An App ID** `gr.artemisrental.crm` with the **Push Notifications** capability (developer.apple.com › Identifiers).
3. **An APNs Auth Key (.p8)**: developer.apple.com › Keys › "+" › enable *Apple Push Notifications service*. Download `AuthKey_XXXXXXXXXX.p8` (you can only download it once), and note the **Key ID** and your **Team ID**.

### Steps

**1. App.** In `project.yml`, uncomment
`CODE_SIGN_ENTITLEMENTS: ArtemisCRM/Resources/ArtemisCRM.entitlements` (it contains `aps-environment`).
In `ArtemisCRM/Resources/Info.plist`, set `ArtemisRemotePushEnabled` to `true`. Then run
`xcodegen generate` and build to a real device (the simulator cannot receive real pushes). Settings ›
"Remote push" should say *Ενεργό*, and you can copy the token from there. Debug builds register as
`development` (sandbox) and TestFlight/App Store builds as `production`.

**2. Database: the `device_tokens` table.** Run this in the SQL editor:

```sql
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

create policy "Artemis admin all device_tokens"
  on public.device_tokens for all to authenticated
  using (public.is_artemis_admin()) with check (public.is_artemis_admin());

drop trigger if exists update_device_tokens_updated_at on public.device_tokens;
create trigger update_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.update_updated_at_column();
```

**3. Edge function.** Deploy it and set its secrets:

```sh
supabase functions deploy push-new-request --no-verify-jwt
supabase secrets set \
  APNS_KEY_ID=XXXXXXXXXX \
  APNS_TEAM_ID=YYYYYYYYYY \
  APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)" \
  PUSH_WEBHOOK_SECRET="$(openssl rand -hex 24)"
# optional: APNS_BUNDLE_ID=gr.artemisrental.crm (default)
```

**4. Database webhook.** In the Dashboard, go to Database › Webhooks › Create:

* Table `public.booking_requests`, events **Insert**
* Type *Supabase Edge Functions* → `push-new-request`, method POST
* HTTP header `x-webhook-secret: <the PUSH_WEBHOOK_SECRET value>`

Or the same thing in SQL with `pg_net`:

```sql
create or replace trigger booking_requests_push
  after insert on public.booking_requests
  for each row execute function supabase_functions.http_request(
    'https://ogbjgmxmlmgpcsdmrkcq.supabase.co/functions/v1/push-new-request',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<PUSH_WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
```

For every new request, the function sends "Νέο αίτημα κράτησης: name, vehicle, dates" to each stored
token, with the badge set to the number of `new` requests and `request_id` in the payload so a tap opens
the request. It deletes tokens that APNs reports as unregistered.

## Project layout

```
ios/
  project.yml                 XcodeGen spec (source of truth for the .xcodeproj)
  ArtemisCRM/
    App/                      App entry, AppDelegate (notifications, BG task), tab bar, banner, routes
    Models/                   Codable rows mirroring src/integrations/supabase/types.ts + write payloads
    Logic/BusinessLogic.swift status.ts, whatsapp.ts, ratePricing.ts, availability, formatting
    Services/                 Backend protocol, SupabaseBackend, AppStore, Router/Auth, NotificationManager
    Design/                   Theme (brand colours, cards, pills, tabs, skeleton), TripCard
    Features/                 Login, Today, Bookings, Requests, Fleet, More (Clients, Money, Settings)
    Demo/                     DEBUG-only DemoBackend + sample data
    Resources/                Info.plist, entitlements, Assets (app icon, logo, colour sets)
  scripts/                    run-demo.sh, screenshots.sh, make_icon.swift
  screenshots/                Light/dark captures of every screen (demo data)
```

Brand colours are colour sets with dark variants: Navy `#0B2A3C`, Sun `#C9833A`, Olive `#3F4A2F`. The
app supports Dynamic Type, dark mode, haptics, pull-to-refresh, search, swipe actions, context menus, and
redacted skeleton loading.

## Notes and limits

* Only `info@artemisrental.gr` can sign in. RLS enforces this, and the app also signs out any other account, like `useAuth.tsx`.
* Not in the app yet (still on the web): vehicle check-in/out checklists, client merge, creating or editing vehicle models and plates, maintenance blocks, extra fees and discounts in the booking form (existing `extra_fees_json` is kept untouched), and deleting bookings.
* Fleet photos come from `vehicles.image_url`. Demo mode uses the photos on rentacarsifnos.com.
