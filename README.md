# Artemis Backend

Standalone booking admin for **Artemis Rental** (Sifnos).

- Vite + React + Supabase
- Fleet: cars and scooters
- Access: authenticated admin only (`info@artemisrental.gr`)

## Setup

```bash
npm install
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Auth

Only `info@artemisrental.gr` can sign in. Database RLS uses `is_artemis_admin()` so other authenticated users cannot read or write data. Do not commit secrets or passwords.
