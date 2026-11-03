// push-new-request: sends an APNs push to every registered Artemis CRM iPhone when a
// website booking request is inserted. Called by a Database Webhook on
// public.booking_requests (INSERT). Setup: ios/README.md › "Remote push".
//
// Secrets (supabase secrets set ...):
//   APNS_KEY_ID        Key ID of the APNs Auth Key (.p8)
//   APNS_TEAM_ID       Apple Developer Team ID
//   APNS_PRIVATE_KEY   Full contents of AuthKey_XXXXXXXXXX.p8 (BEGIN/END lines included)
//   APNS_BUNDLE_ID     Optional, default gr.artemisrental.crm
//   PUSH_WEBHOOK_SECRET  Shared secret the webhook sends in the x-webhook-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type BookingRequest = {
  id: string;
  customer_name: string;
  requested_vehicle: string | null;
  check_in: string;
  check_out: string;
  status: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: BookingRequest | null;
};

const BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "gr.artemisrental.crm";

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

/** ES256 provider token. Apple accepts one for up to an hour; refresh every 50 minutes. */
async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const pem = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !pem) throw new Error("APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY must be set");

  const der = Uint8Array.from(
    atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${claims}`));
  const token = `${header}.${claims}.${base64url(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

/** "6/11 – 11/11" */
function shortRange(a: string, b: string): string {
  const f = (s: string) => {
    const [, m, d] = s.slice(0, 10).split("-");
    return `${Number(d)}/${Number(m)}`;
  };
  return `${f(a)} – ${f(b)}`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const r = payload.record;
  if (payload.type !== "INSERT" || payload.table !== "booking_requests" || !r) {
    return Response.json({ skipped: true });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Vehicle name for the message: match the website slug, else show the raw text.
  let vehicleName = r.requested_vehicle ?? "Όχημα";
  if (r.requested_vehicle) {
    const { data: v } = await supabase.from("vehicles").select("name").eq("slug", r.requested_vehicle).maybeSingle();
    if (v?.name) vehicleName = v.name;
  }

  const [{ data: tokens, error: tokenError }, { count }] = await Promise.all([
    supabase.from("device_tokens").select("token, environment").eq("bundle_id", BUNDLE_ID),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if (tokenError) return Response.json({ error: tokenError.message }, { status: 500 });
  if (!tokens?.length) return Response.json({ sent: 0, reason: "no device tokens" });

  const jwt = await apnsJwt();
  const body = JSON.stringify({
    aps: {
      alert: {
        title: "Νέο αίτημα κράτησης",
        body: `Νέο αίτημα κράτησης: ${r.customer_name}, ${vehicleName}, ${shortRange(r.check_in, r.check_out)}`,
      },
      sound: "default",
      badge: count ?? 1,
      "thread-id": "booking-requests",
    },
    request_id: r.id, // the app opens this request when the notification is tapped
  });

  const results = await Promise.all(
    tokens.map(async ({ token, environment }) => {
      const host = environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
      const res = await fetch(`${host}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "apns-collapse-id": `request-${r.id}`.slice(0, 64),
          "content-type": "application/json",
        },
        body,
      });
      const text = res.ok ? "" : await res.text();
      // 410 Unregistered / 400 BadDeviceToken: forget the token.
      if (res.status === 410 || text.includes("BadDeviceToken")) {
        await supabase.from("device_tokens").delete().eq("token", token);
      }
      return { token: token.slice(0, 8), status: res.status, error: text || undefined };
    }),
  );

  return Response.json({ sent: results.filter((x) => x.status === 200).length, results });
});
