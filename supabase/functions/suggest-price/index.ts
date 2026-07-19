import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vehicle_name, daily_rate_low, daily_rate_high, check_in, check_out } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Είσαι σύμβουλος τιμολόγησης για εταιρεία ενοικίασης οχημάτων στη Φολέγανδρο, Ελλάδα.

Όχημα: ${vehicle_name}
Τιμή/ημέρα (χαμηλή-υψηλή): ${daily_rate_low}€ - ${daily_rate_high}€
Check-in: ${check_in}
Check-out: ${check_out}

Κανόνες τιμολόγησης:
- Ιούλιος-Αύγουστος: +25-35% (peak season)
- Ιούνιος & Σεπτέμβριος: κανονική τιμή (mid season)
- Υπόλοιποι μήνες: -10-20% (low season)
- 7+ μέρες ενοικίαση: -10-15% έκπτωση
- 14+ μέρες: -20% έκπτωση

Απάντησε ΜΟΝΟ σε JSON: {"suggested_total": number, "daily_rate": number, "explanation": "string σε Ελληνικά"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "suggest_price",
            description: "Return pricing suggestion",
            parameters: {
              type: "object",
              properties: {
                suggested_total: { type: "number", description: "Suggested total price in euros" },
                daily_rate: { type: "number", description: "Suggested daily rate in euros" },
                explanation: { type: "string", description: "Explanation in Greek" },
              },
              required: ["suggested_total", "daily_rate", "explanation"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_price" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Υπέρβαση ορίου αιτημάτων, δοκιμάστε ξανά σε λίγο." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Απαιτείται πληρωμή για AI λειτουργίες." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content
    const content = result.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse AI response");
  } catch (e) {
    console.error("suggest-price error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
