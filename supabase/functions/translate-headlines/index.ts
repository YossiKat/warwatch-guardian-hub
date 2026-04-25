import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory cache to avoid re-translating
const translationCache = new Map<string, string>();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter: only translate non-Hebrew texts
    const hebrewRegex = /[\u0590-\u05FF]/;
    const toTranslate: { index: number; text: string }[] = [];
    const results: string[] = new Array(texts.length);

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (hebrewRegex.test(t)) {
        // Already Hebrew
        results[i] = t;
      } else if (translationCache.has(t)) {
        results[i] = translationCache.get(t)!;
      } else {
        toTranslate.push({ index: i, text: t });
      }
    }

    if (toTranslate.length === 0) {
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch translate using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // No API key — return originals
      for (const item of toTranslate) results[item.index] = item.text;
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numberedTexts = toTranslate.map((item, i) => `${i + 1}. ${item.text}`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a professional news translator. Translate the following news headlines to Hebrew. Keep it concise and journalistic. Return ONLY the translations, one per line, numbered to match input. Do not add explanations.`,
          },
          { role: "user", content: numberedTexts },
        ],
      }),
    });

    if (!response.ok) {
      // Fallback: return originals
      for (const item of toTranslate) results[item.index] = item.text;
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const lines = content.split("\n").filter((l: string) => l.trim());

    for (let i = 0; i < toTranslate.length; i++) {
      let translated = lines[i]?.replace(/^\d+\.\s*/, "").trim() || toTranslate[i].text;
      results[toTranslate[i].index] = translated;
      translationCache.set(toTranslate[i].text, translated);
    }

    // Cap cache size
    if (translationCache.size > 500) {
      const keys = [...translationCache.keys()];
      for (let i = 0; i < 100; i++) translationCache.delete(keys[i]);
    }

    return new Response(JSON.stringify({ translations: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
