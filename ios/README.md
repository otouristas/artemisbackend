# Artemis CRM for iOS

The native iPhone back office for Artemis Rental (Σίφνος). It uses the same Supabase project, the same
login (`info@artemisrental.gr`) and the same row-level security as the web CRM in this repo, and the
same business rules (status labels, WhatsApp messages, nightly pricing from `vehicle_rates`).

SwiftUI, iOS 17+, Swift 5 language mode, `supabase-swift` 2.x via Swift Package Manager. The UI is in Greek.

| Tab | What it does |
| --- | --- |
| **Σήμερα** | Date header, KPIs (αφίξεις, αναχωρήσεις, εκκρεμείς, ανοιχτά υπόλοιπα), today's pickups and returns as trip cards with call and WhatsApp buttons, a callout for new website requests, and the next 7 days. |
| **Κρατήσεις** | Επερχόμενες / Σε ενοικίαση / Ιστορικό tabs, grouped by day, search, swipe (confirm, WhatsApp, call, cancel), context menus. Booking detail shows the trip, the customer, payment (total, extra fee lines, deposit, balance), the **vehicle checklists**, confirm/cancel and **delete** (with confirmation, also in the edit form). The form creates and edits bookings. It shows the free units per model for the chosen dates, a plate picker that marks plates already taken, the client (existing, or created on save like the web), an automatic price from `vehicle_rates`, **extra fee lines and the returning-customer discount** (stored in `extra_fees_json`, included in the automatic total), and a manual override. |
| **Αιτήματα** | Website requests. Νέα / Ελεγμένα / Αποδεκτά / Απορριφθέντα / Όλα, with a badge on the tab showing how many are new. The detail shows the trip, the guest's message, contact buttons, and availability (free units, clashing bookings, alternative models). **Αποδοχή** opens the booking form pre-filled. Saving creates the booking and sets the request to `accepted` with its `booking_id`. You can also reject a request or mark it reviewed. |
| **Στόλος** | Model cards with photo, units free today (x/y), today's price and a maintenance / off-site pill. **+** adds a new model (name, type, cc, low/high rate, photo URL, quantity and a plate per unit, notes) or more units to an existing model. Model detail shows every unit today (on rent, free, or held by maintenance), a 14-day availability strip, **maintenance blocks** (create, delete, active/planned/done), upcoming bookings, and the price periods (add, edit, delete; overlaps are rejected, as in the database). **Επεξεργασία** edits quantity and plates per unit, notes, active, photo URL, and the site listing (slug + show on site). |
| **Περισσότερα** | Πελάτες (search, history, totals, **merge duplicates**: profiles with the same phone, last 10 digits, can be merged into the open one), Οικονομικά (season total, collected vs open, monthly Swift Charts bars, payment methods, open balances), Ρυθμίσεις (appearance, notification status and toggle, test notification, background/push status, sign out, version). |

Availability follows `public.site_vehicle_availability()`. A pending or confirmed booking holds one unit
from check-in through the return day **inclusive**, and each `vehicle_blocks` row holds one unit. Price is
the sum of the nightly rates, with nights = check_out − check_in, as in `src/lib/ratePricing.ts`.

### Web logic the new features follow

* **Checklists** (`VehicleChecklist.tsx`, `useVehicleChecklists.ts`): rows in `vehicle_checklists` per booking, type `check_in` (Παράδοση) / `check_out` (Παραλαβή), fuel 0–100 in steps of 5, mileage, damage notes, photos. The form defaults to the missing step. Photos are resized (longest side 1600 px, JPEG 0.8), uploaded to the public `vehicle-photos` bucket as `<ms>_<random>.jpg` at the root, and their public URLs stored in `photo_urls`. With both steps recorded the card shows the km driven and the fuel difference. Photos open full screen. You can pick from the library or use the camera.
* **Client merge** (`MergeDuplicatesCard.tsx`, `useMergeClients`): duplicates are other clients whose phone has the same last 10 digits (at least 6). Merging moves `bookings.client_id` to the open profile, then deletes the duplicate.
* **Models and plates** (`FleetFormPage.tsx`, `FleetModelDetail.tsx`, `VehicleRatesPage.tsx`): plates are written as the comma string `plate` the web reads first (and mirrored to `plates`); the app now reads `plate` first like `parsePlates()`. Adding units appends plates and raises `quantity`. Quantity is 1–50. The slug is cleaned like `saveListing()`, and a duplicate slug shows "Το slug χρησιμοποιείται ήδη από άλλο όχημα". New models get no slug, like the web: set it in Επεξεργασία to show the model on the site.
* **Maintenance blocks** (`useVehicleBlocks.ts`): insert/delete in `vehicle_blocks`. Each block holds one unit from start to end date inclusive, the same as a booking, in the app and in the site functions.
* **Extra fees and discount** (`BookingFormPage.tsx`): `extra_fees_json` is `[{"id","label","amount"}]`; the discount is the line with id `returning-discount`, label `Έκπτωση παλιού πελάτη (X€)` and a negative amount; null when empty. Automatic total = rental + fees + discount, applied only when the price is not manual and the total is positive. Edits start in manual price mode, like the web.
* **Delete booking**: `delete from bookings`; the database cascades its checklists and clears `booking_requests.booking_id`.

## Brand, launch, onboarding, appearance

* The Artemis Rental logo (`src/assets/logo.svg`, white variant from the website's brand folder) is in the asset catalog as vectors: `BrandLogo` (blue, white in dark mode), `Logo` (white template, splash and login) and `BrandSymbol` (bow and arrow). The SVGs were rewritten with inline fill/stroke attributes, because the asset compiler ignores CSS `<style>` classes. It appears in the Today header (top-left), on the login screen, in Περισσότερα and in Ρυθμίσεις.
* `Resources/LaunchScreen.storyboard`: navy with the white logo. Then the in-app splash (logo scale and fade, about 0.9 s) while the session restores.
* Onboarding: four pages on the first launch, before login (Σήμερα, Αιτήματα από το site, Στόλος & τιμές, Ειδοποιήσεις). The last page asks for notification permission, offers the appearance choice and leads to Σύνδεση. Completion is stored in UserDefaults (`onboarding.completed.v1`).
* Appearance: Ρυθμίσεις › Εμφάνιση (Αυτόματο / Φωτεινό / Σκούρο), stored with `@AppStorage("appearance")`, default Φωτεινό, applied at the root so it reaches every screen and sheet.
* Login: the email field is prefilled with `info@artemisrental.gr` (like `LoginPage.tsx`), the email is trimmed and lowercased before the check, and a near miss (up to 2 typos, e.g. `info@artemisrentals.gr`) shows "Το σωστό email είναι info@artemisrental.gr" with a one-tap fix instead of trying to sign in. The password is never stored or logged by the app.

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
* `-DemoRoute <route>` opens a screen directly, for screenshots: `today`, `today/new`, `bookings`, `bookings/detail`, `bookings/checklist`, `bookings/checklist/new`, `bookings/edit`, `bookings/delete`, `requests`, `requests/detail`, `requests/accept`, `fleet`, `fleet/detail`, `fleet/maintenance`, `fleet/block`, `fleet/edit`, `fleet/new`, `fleet/units`, `more`, `more/clients`, `more/client`, `more/client/merge`, `more/money`, `more/settings`.
* `-DemoAppearance system|light|dark` sets the stored appearance before launch.
* `-ResetOnboarding` clears the onboarding flag and shows it (also in demo mode); `-OnboardingPage <0-3>` opens a page; `-DemoNotificationsUnasked` shows the "enable notifications" step even when the simulator already allowed them.
* `-DemoHoldSplash` keeps the splash on screen. `-DemoLoginEmail <email>` prefills the login email (normal launch, no `-DemoMode`).

The demo data also has a duplicate client (Maria Papadopoulou, same phone as Μαρία Παπαδοπούλου), extra fees and a discount on today's first pickup, three maintenance blocks on the Chevrolet Spark (now, done, planned) and checklists with drawn sample photos. Demo photo uploads are written to the app's Caches folder.

`scripts/screenshots.sh` captures the screens in light and dark mode into `screenshots/` as JPEG (660 px).
It needs a booted simulator with the app installed, and notifications allowed once. `SCREENS` and `MODES`
pick a subset, `SHOT_DELAY` the wait per screen.

## Notifications

1. **Permission**: the app asks right after login.
2. **While the app is running**: a Supabase Realtime subscription on `booking_requests` INSERT posts a local notification ("Νέο αίτημα κράτησης: name, vehicle, dates"), shows an in-app banner and updates the tab badge. Realtime also refreshes the data when bookings, vehicles, rates, clients or blocks change. `booking_requests` is already in the `supabase_realtime` publication (migration `20260729160000`).
3. **In the background**: a `BGAppRefreshTask` (`gr.artemisrental.crm.refresh`) fetches requests created since the last one seen, posts a local notification for each new one, and sets the app icon badge to the number of `new` requests. iOS decides when it runs, typically every 15 minutes to a few hours depending on usage. Background App Refresh must be on for the app. To trigger it in the debugger, run `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"gr.artemisrental.crm.refresh"]`.
4. **Tapping a notification** opens that request. The payload key is `request_id`. Deep links work too: `artemiscrm://request/<uuid>` and `artemiscrm://booking/<uuid>`.

With only steps 2–3, nothing is guaranteed to arrive while the app is fully closed: iOS does not run
background refresh for an app the user force-quit. For instant alerts at all times, set up remote push.

## Remote push (when the app is closed)

`ArtemisRemotePushEnabled` is on. With permission granted, the app registers with APNs and saves its device
token to `public.device_tokens`; the edge function `supabase/functions/push-new-request` sends the push. The
table (migration `20261104010000`) and the function are live in production.

### What the owner needs to provide

1. **Apple Developer Program membership** (paid, €99/year). It is needed for push, TestFlight and the App Store.
2. **An App ID** `gr.artemisrental.crm` with the **Push Notifications** capability (developer.apple.com › Identifiers).
3. **An APNs Auth Key (.p8)**: developer.apple.com › Keys › "+" › enable *Apple Push Notifications service*. Download `AuthKey_XXXXXXXXXX.p8` (you can only download it once), and note the **Key ID** and your **Team ID**.

### Steps

**1. App.** Done in this repo: `project.yml` sets
`CODE_SIGN_ENTITLEMENTS: ArtemisCRM/Resources/ArtemisCRM.entitlements` (`aps-environment`; archive/TestFlight
signing switches it to production) and `Info.plist` has `ArtemisRemotePushEnabled` = `true`. The App ID needs the
Push Notifications capability, otherwise signing fails: set the flag back to `false` and comment the line out.
On every launch and every return to the foreground, while signed in with notifications allowed, the app calls
`registerForRemoteNotifications()`. Each token iOS hands back is upserted into `public.device_tokens` (even if it is
unchanged), with `environment` `development` for Debug builds and `production` for Release (TestFlight/App Store).
It counts as saved only after the upsert succeeds; a failure is retried on the next launch or foreground.
Settings › Παρασκήνιο & push shows "Token στον server" (saved, when, or failed) and **Επανεγγραφή** to retry now.
The simulator cannot receive real pushes.

**2. Database: the `device_tokens` table.** Applied in production (migration `20261104010000`). For another project, run:

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
    Design/Brand.swift        Logo views, splash, appearance setting
    Features/                 Login, Onboarding, Today, Bookings (+ checklists), Requests, Fleet (+ model forms,
                              maintenance), More (Clients + merge, Money, Settings)
    Demo/                     DEBUG-only DemoBackend + sample data
    Resources/                Info.plist, entitlements, LaunchScreen.storyboard, Assets (app icon, logos, colour sets)
  scripts/                    run-demo.sh, screenshots.sh, make_icon.swift
  screenshots/                Light/dark captures of every screen (demo data)
```

Brand colours are colour sets with dark variants: Navy `#0B2A3C`, Sun `#C9833A`, Olive `#3F4A2F`. The
app supports Dynamic Type, dark mode, haptics, pull-to-refresh, search, swipe actions, context menus, and
redacted skeleton loading.

## Notes and limits

* Only `info@artemisrental.gr` can sign in. RLS enforces this, and the app also signs out any other account, like `useAuth.tsx`.
* Still only on the web: editing a client's profile fields and tags, duplicating a booking, the yearly price calendar, copying periods from another model and the bulk monthly prices, and editing a model's name, cc or legacy low/high rates.
* Checklist photos cannot be deleted from the app (the web cannot either).
* Fleet photos come from `vehicles.image_url`. Demo mode uses the photos on rentacarsifnos.com.
