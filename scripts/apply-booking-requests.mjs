#!/usr/bin/env node
/**
 * Apply booking_requests migration to Artemis Supabase via Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-booking-requests.mjs
 *
 * Get a token from: https://supabase.com/dashboard/account/tokens
 * (must belong to the account that owns ogbjgmxmlmgpcsdmrkcq)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "ogbjgmxmlmgpcsdmrkcq";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(
  resolve(root, "supabase/migrations/20260729160000_booking_requests.sql"),
  "utf8",
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
