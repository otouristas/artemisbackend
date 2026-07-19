# Artemis CRM

Standalone booking CRM for **Artemis Rental** (Sifnos).

## Modules

- **Σήμερα**: arrivals, departures, pending, balances, 7-day occupancy
- **Κρατήσεις**: pipeline + calendar / list
- **Πελάτες**: CRM profiles, LTV, merge duplicates
- **Στόλος**: inventory, plates, maintenance blocks
- **Οικονομικά**: expected / collected / open balances
- **Στατιστικά**: season KPIs and charts

## Setup

```bash
npm install
cp .env.example .env
# VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Auth

Only `info@artemisrental.gr` can sign in. RLS uses `is_artemis_admin()`.

## Shortcuts

- `Cmd/Ctrl + K`: command palette
