// push-new-request: sends an APNs push to every registered Artemis CRM iPhone when a
// website booking request is inserted. Called by the booking_requests_push trigger
// (migration 20261104010000) with { request_id } only. Setup: ios/README.md › "Remote push".
//
// The caller is not trusted: the function re-reads the request with the service role, only
// pushes requests created in the last 10 minutes, and claims push_sent_at so each request is
// pushed at most once. Deploy with JWT verification off (the trigger sends no auth header).
//
// Secrets:
//   APNS_KEY_ID        Key ID of the APNs Auth Key (.p8)
//   APNS_TEAM_ID       Apple Developer Team ID
//   APNS_PRIVATE_KEY   Full contents of AuthKey_XXXXXXXXXX.p8 (BEGIN/END lines included)
//   APNS_BUNDLE_ID     Optional, default gr.artemisrental.crm
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

const FRESH_MINUTES = 10;

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
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let requestId: unknown;
  try {
    ({ request_id: requestId } = await req.json());
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return new Response("bad request_id", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Claim the request: only fresh, not yet pushed. A second call for the same id gets no row.
  const freshSince = new Date(Date.now() - FRESH_MINUTES * 60_000).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("booking_requests")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", requestId)
    .is("push_sent_at", null)
    .gte("created_at", freshSince)
    .select("id, customer_name, requested_vehicle, check_in, check_out, status")
    .maybeSingle();
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });
  if (!claimed) return Response.json({ skipped: true });
  const r = claimed as BookingRequest;

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
