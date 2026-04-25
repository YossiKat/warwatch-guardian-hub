import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResult {
  system: string;
  status: "ok" | "warning" | "error";
  latencyMs: number;
  message: string;
  lastDataAge?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: HealthCheckResult[] = [];
  const now = Date.now();

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    const { error } = await supabase.from("oref_alerts").select("id").limit(1);
    results.push({
      system: "מסד נתונים",
      status: error ? "error" : "ok",
      latencyMs: Date.now() - dbStart,
      message: error ? `שגיאה: ${error.message}` : "חיבור תקין",
    });
  } catch (e) {
    results.push({ system: "מסד נתונים", status: "error", latencyMs: Date.now() - dbStart, message: `קריסה: ${e.message}` });
  }

  // 2. Oref alerts freshness
  const orefStart = Date.now();
  try {
    const { data, error } = await supabase.from("oref_alerts").select("alert_date").order("alert_date", { ascending: false }).limit(1);
    const lastAlert = data?.[0]?.alert_date;
    const ageHours = lastAlert ? (now - new Date(lastAlert).getTime()) / 3600000 : Infinity;
    results.push({
      system: "התרעות פיקוד העורף",
      status: ageHours < 24 ? "ok" : ageHours < 72 ? "warning" : "error",
      latencyMs: Date.now() - orefStart,
      message: lastAlert ? `אחרונה: ${new Date(lastAlert).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: lastAlert ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "התרעות פיקוד העורף", status: "error", latencyMs: Date.now() - orefStart, message: e.message });
  }

  // 3. Telegram messages freshness
  const tgStart = Date.now();
  try {
    const { data, error } = await supabase.from("telegram_messages").select("created_at").order("created_at", { ascending: false }).limit(1);
    const lastMsg = data?.[0]?.created_at;
    const ageHours = lastMsg ? (now - new Date(lastMsg).getTime()) / 3600000 : Infinity;
    results.push({
      system: "מודיעין טלגרם",
      status: ageHours < 6 ? "ok" : ageHours < 24 ? "warning" : "error",
      latencyMs: Date.now() - tgStart,
      message: lastMsg ? `אחרון: ${new Date(lastMsg).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: lastMsg ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "מודיעין טלגרם", status: "error", latencyMs: Date.now() - tgStart, message: e.message });
  }

  // 4. Intel reports freshness
  const intelStart = Date.now();
  try {
    const { data, error } = await supabase.from("intel_reports").select("created_at").order("created_at", { ascending: false }).limit(1);
    const lastReport = data?.[0]?.created_at;
    const ageHours = lastReport ? (now - new Date(lastReport).getTime()) / 3600000 : Infinity;
    results.push({
      system: "דוחות מודיעין",
      status: ageHours < 24 ? "ok" : ageHours < 72 ? "warning" : "error",
      latencyMs: Date.now() - intelStart,
      message: lastReport ? `אחרון: ${new Date(lastReport).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: lastReport ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "דוחות מודיעין", status: "error", latencyMs: Date.now() - intelStart, message: e.message });
  }

  // 5. Sentiment analysis freshness
  const sentStart = Date.now();
  try {
    const { data, error } = await supabase.from("sentiment_scores").select("created_at").order("created_at", { ascending: false }).limit(1);
    const last = data?.[0]?.created_at;
    const ageHours = last ? (now - new Date(last).getTime()) / 3600000 : Infinity;
    results.push({
      system: "ניתוח סנטימנט",
      status: ageHours < 12 ? "ok" : ageHours < 48 ? "warning" : "error",
      latencyMs: Date.now() - sentStart,
      message: last ? `אחרון: ${new Date(last).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: last ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "ניתוח סנטימנט", status: "error", latencyMs: Date.now() - sentStart, message: e.message });
  }

  // 6. Emergency events freshness
  const emStart = Date.now();
  try {
    const { data, error } = await supabase.from("emergency_events").select("created_at").order("created_at", { ascending: false }).limit(1);
    const last = data?.[0]?.created_at;
    const ageHours = last ? (now - new Date(last).getTime()) / 3600000 : Infinity;
    results.push({
      system: "אירועי חירום",
      status: ageHours < 6 ? "ok" : ageHours < 24 ? "warning" : "error",
      latencyMs: Date.now() - emStart,
      message: last ? `אחרון: ${new Date(last).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: last ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "אירועי חירום", status: "error", latencyMs: Date.now() - emStart, message: e.message });
  }

  // 7. Daily intel report freshness
  const dirStart = Date.now();
  try {
    const { data, error } = await supabase.from("daily_intel_reports").select("created_at").order("created_at", { ascending: false }).limit(1);
    const last = data?.[0]?.created_at;
    const ageHours = last ? (now - new Date(last).getTime()) / 3600000 : Infinity;
    results.push({
      system: "דוח מודיעין יומי",
      status: ageHours < 28 ? "ok" : ageHours < 72 ? "warning" : "error",
      latencyMs: Date.now() - dirStart,
      message: last ? `אחרון: ${new Date(last).toLocaleString("he-IL")}` : "אין נתונים",
      lastDataAge: last ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "דוח מודיעין יומי", status: "error", latencyMs: Date.now() - dirStart, message: e.message });
  }

  // 8. Push subscriptions
  const pushStart = Date.now();
  try {
    const { count, error } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
    results.push({
      system: "מנויי התראות Push",
      status: (count || 0) > 0 ? "ok" : "warning",
      latencyMs: Date.now() - pushStart,
      message: `${count || 0} מנויים רשומים`,
    });
  } catch (e) {
    results.push({ system: "מנויי התראות Push", status: "error", latencyMs: Date.now() - pushStart, message: e.message });
  }

  // 9. Telegram bot state
  const botStart = Date.now();
  try {
    const { data: bot, error } = await supabase
      .from("telegram_bot_state")
      .select("bot_name, update_offset, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const ageHours = bot?.updated_at ? (now - new Date(bot.updated_at).getTime()) / 3600000 : Infinity;
    results.push({
      system: "בוט טלגרם",
      status: ageHours < 1 ? "ok" : ageHours < 6 ? "warning" : "error",
      latencyMs: Date.now() - botStart,
      message: bot ? `${bot.bot_name} · offset: ${bot.update_offset}, עדכון: ${new Date(bot.updated_at).toLocaleString("he-IL")}` : "לא נמצא",
      lastDataAge: bot?.updated_at ? `${Math.floor(ageHours)}ש'` : "∞",
    });
  } catch (e) {
    results.push({ system: "בוט טלגרם", status: "error", latencyMs: Date.now() - botStart, message: e.message });
  }

  // Summary
  const okCount = results.filter(r => r.status === "ok").length;
  const warnCount = results.filter(r => r.status === "warning").length;
  const errCount = results.filter(r => r.status === "error").length;
  const totalLatency = results.reduce((s, r) => s + r.latencyMs, 0);
  const overallStatus = errCount > 0 ? "error" : warnCount > 2 ? "warning" : "ok";

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    overallStatus,
    summary: { ok: okCount, warning: warnCount, error: errCount, totalLatencyMs: totalLatency },
    checks: results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
