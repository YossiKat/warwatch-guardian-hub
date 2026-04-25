import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const reportDate = now.toISOString().split('T')[0];

    // Gather data from all sources in parallel
    const [emergencyRes, intelRes, orefRes, telegramRes, sentimentRes] = await Promise.all([
      sb.from('emergency_events').select('*').gte('created_at', twentyFourHoursAgo).order('created_at', { ascending: false }),
      sb.from('intel_reports').select('*').gte('created_at', twentyFourHoursAgo).order('created_at', { ascending: false }),
      sb.from('oref_alerts').select('*').gte('created_at', twentyFourHoursAgo).order('created_at', { ascending: false }),
      sb.from('telegram_messages').select('*').gte('created_at', twentyFourHoursAgo).eq('is_duplicate', false).order('created_at', { ascending: false }),
      sb.from('sentiment_scores').select('*').order('created_at', { ascending: false }).limit(1),
    ]);

    const emergencyEvents = emergencyRes.data || [];
    const intelReports = intelRes.data || [];
    const orefAlerts = orefRes.data || [];
    const telegramMsgs = telegramRes.data || [];
    const latestSentiment = sentimentRes.data?.[0];

    // Source statistics
    const sourceStats = {
      emergency_events: emergencyEvents.length,
      intel_reports: intelReports.length,
      oref_alerts: orefAlerts.length,
      telegram_messages: telegramMsgs.length,
      total: emergencyEvents.length + intelReports.length + orefAlerts.length + telegramMsgs.length,
      sentiment_score: latestSentiment?.score || 0,
      sentiment_label: latestSentiment?.label || 'neutral',
    };

    // Severity analysis
    const criticalEvents = emergencyEvents.filter(e => e.color === 'red' || e.score >= 80);
    const highEvents = emergencyEvents.filter(e => e.color === 'orange' || (e.score >= 50 && e.score < 80));
    const criticalTelegram = telegramMsgs.filter(m => m.severity === 'critical');
    const highTelegram = telegramMsgs.filter(m => m.severity === 'high');

    // Launch detection keywords
    const launchKeywords = ['שיגור', 'טיל', 'בליסטי', 'launch', 'missile', 'ballistic', 'إطلاق', 'صاروخ', 'טעינת משגרים', 'שיגור מאיראן'];
    const leaderKeywords = ['הצהרה', 'נאום', 'הכריז', 'statement', 'declared', 'خطاب', 'تصريح', 'חמינאי', 'נסראללה', 'Khamenei', 'Nasrallah'];
    
    const checkKeywords = (text: string, keywords: string[]) => 
      keywords.some(kw => text?.toLowerCase().includes(kw.toLowerCase()));

    const launchDetections: { text: string; source: string; time: string }[] = [];
    const leaderStatements: { text: string; source: string; time: string }[] = [];
    const keyFindings: string[] = [];

    // Scan telegram messages for patterns
    for (const msg of telegramMsgs) {
      const text = msg.text || '';
      if (checkKeywords(text, launchKeywords)) {
        launchDetections.push({ text: text.substring(0, 120), source: `telegram/${msg.bot_name || 'unknown'}`, time: msg.created_at });
      }
      if (checkKeywords(text, leaderKeywords)) {
        leaderStatements.push({ text: text.substring(0, 120), source: `telegram/${msg.bot_name || 'unknown'}`, time: msg.created_at });
      }
    }

    // Scan intel reports
    for (const report of intelReports) {
      const text = `${report.title} ${report.summary}`;
      if (checkKeywords(text, launchKeywords)) {
        launchDetections.push({ text: `[INTEL] ${report.title}`, source: report.source, time: report.created_at });
      }
      if (checkKeywords(text, leaderKeywords)) {
        leaderStatements.push({ text: `[INTEL] ${report.title}`, source: report.source, time: report.created_at });
      }
    }

    // Scan emergency events
    for (const event of emergencyEvents) {
      const text = `${event.title} ${event.description || ''}`;
      if (checkKeywords(text, launchKeywords)) {
        launchDetections.push({ text: `[EVENT] ${event.title}`, source: event.source, time: event.created_at });
      }
    }

    // Helper to format time
    const fmtTime = (iso: string) => {
      try { return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
    };

    // Helper to calculate confidence
    const calcConfidence = (count: number, hasTelegram: boolean, hasOref: boolean, hasEmergency: boolean) => {
      let conf = 40;
      if (count > 3) conf += 20;
      if (hasTelegram) conf += 15;
      if (hasOref) conf += 25;
      if (hasEmergency) conf += 15;
      return Math.min(conf, 100);
    };

    // Build key findings with source, time, and confidence
    if (launchDetections.length > 0) {
      const sources = [...new Set(launchDetections.map(d => d.source))];
      const latest = launchDetections[0];
      const conf = calcConfidence(launchDetections.length, sources.some(s => s.startsWith('telegram')), orefAlerts.length > 0, criticalEvents.length > 0);
      keyFindings.push(`🚀 זוהו ${launchDetections.length} אירועי שיגור/טילים - מקורות: ${sources.slice(0, 3).join(', ')} | ${fmtTime(latest.time)} | ביטחון: ${conf}% — ${latest.text}`);
    }
    if (leaderStatements.length > 0) {
      const sources = [...new Set(leaderStatements.map(d => d.source))];
      const latest = leaderStatements[0];
      keyFindings.push(`📢 ${leaderStatements.length} הצהרות מנהיגים - מקורות: ${sources.slice(0, 3).join(', ')} | ${fmtTime(latest.time)} | ביטחון: ${Math.min(50 + leaderStatements.length * 10, 90)}% — ${latest.text}`);
    }
    if (orefAlerts.length > 0) {
      const locs = orefAlerts.flatMap(a => a.locations || []).slice(0, 5);
      const latest = orefAlerts[0];
      keyFindings.push(`🚨 ${orefAlerts.length} התרעות פיקוד העורף - מקור: פיקוד העורף | ${fmtTime(latest.created_at)} | ביטחון: 100% — אזורים: ${locs.join(', ')}`);
    }
    if (criticalEvents.length > 0) {
      const latest = criticalEvents[0];
      keyFindings.push(`🔴 ${criticalEvents.length} אירועים קריטיים - מקור: ${latest.source} | ${fmtTime(latest.created_at)} | ביטחון: ${latest.score}% — ${latest.title}`);
    }
    if (highEvents.length > 0) {
      const latest = highEvents[0];
      keyFindings.push(`🟠 ${highEvents.length} אירועים ברמת סיכון גבוהה - מקור: ${latest.source} | ${fmtTime(latest.created_at)} | ביטחון: ${latest.score}% — ${latest.title}`);
    }
    if (criticalTelegram.length > 0) {
      const latest = criticalTelegram[0];
      const uniqueSenders = [...new Set(criticalTelegram.map(m => m.bot_name))];
      keyFindings.push(`⚡ ${criticalTelegram.length} הודעות טלגרם קריטיות - מקורות: ${uniqueSenders.join(', ')} | ${fmtTime(latest.created_at)} | ביטחון: ${Math.min(40 + criticalTelegram.length * 15, 95)}% — ${(latest.text || '').slice(0, 80)}`);
    }

    // Calculate threat level
    let threatLevel = 20; // baseline
    threatLevel += Math.min(orefAlerts.length * 15, 30);
    threatLevel += Math.min(criticalEvents.length * 10, 20);
    threatLevel += Math.min(launchDetections.length * 15, 30);
    threatLevel += Math.min(leaderStatements.length * 5, 10);
    threatLevel += Math.min(criticalTelegram.length * 5, 10);
    threatLevel = Math.min(threatLevel, 100);

    // Front analysis
    const iranKeywords = ['איראן', 'iran', 'إيران', 'חמינאי', 'טהראן', 'IRGC'];
    const lebanonKeywords = ['לבנון', 'lebanon', 'لبنان', 'חיזבאללה', 'hezbollah', 'حزب الله', 'נסראללה'];
    const gazaKeywords = ['עזה', 'gaza', 'غزة', 'חמאס', 'hamas', 'حماس'];
    const yemenKeywords = ['תימן', 'yemen', 'يمن', 'חות\'י', 'houthi', 'حوثي'];

    const allTexts = [
      ...telegramMsgs.map(m => m.text || ''),
      ...intelReports.map(r => `${r.title} ${r.summary}`),
      ...emergencyEvents.map(e => `${e.title} ${e.description || ''}`),
    ].join(' ');

    const countKeywords = (text: string, kws: string[]) => 
      kws.reduce((c, kw) => c + (text.toLowerCase().split(kw.toLowerCase()).length - 1), 0);

    const fronts = {
      iran: { mentions: countKeywords(allTexts, iranKeywords), status: 'monitoring' as string, risk: 0 },
      lebanon: { mentions: countKeywords(allTexts, lebanonKeywords), status: 'monitoring' as string, risk: 0 },
      gaza: { mentions: countKeywords(allTexts, gazaKeywords), status: 'monitoring' as string, risk: 0 },
      yemen: { mentions: countKeywords(allTexts, yemenKeywords), status: 'monitoring' as string, risk: 0 },
    };

    // Calculate front risk
    for (const [, front] of Object.entries(fronts)) {
      front.risk = Math.min(front.mentions * 8, 100);
      if (front.risk >= 70) front.status = 'escalating';
      else if (front.risk >= 40) front.status = 'elevated';
    }

    // Recommendations
    const recommendations: string[] = [];
    if (threatLevel >= 70) recommendations.push('🔴 רמת כוננות מרבית - מעקב רציף');
    if (launchDetections.length > 0) recommendations.push('🚀 ערנות לשיגורים - בדיקת מקורות נוספים');
    if (fronts.iran.risk >= 60) recommendations.push('🇮🇷 מעקב מוגבר חזית איראן');
    if (fronts.lebanon.risk >= 60) recommendations.push('🇱🇧 מעקב מוגבר חזית לבנון');
    if (leaderStatements.length > 2) recommendations.push('📢 ניתוח הצהרות מנהיגים - זיהוי מגמות');
    if (recommendations.length === 0) recommendations.push('✅ מצב שגרתי - המשך ניטור');

    // Build summary
    const summary = [
      `📊 דוח מודיעין יומי - ${reportDate}`,
      ``,
      `רמת איום כוללת: ${threatLevel}/100`,
      `סנטימנט: ${latestSentiment?.label || 'N/A'} (${latestSentiment?.score || 0}/100)`,
      ``,
      `📈 סטטיסטיקות: ${sourceStats.total} אירועים מ-${Object.keys(sourceStats).length - 3} מקורות`,
      ``,
      keyFindings.length > 0 ? `ממצאים מרכזיים:\n${keyFindings.join('\n')}` : 'אין ממצאים חריגים',
      ``,
      `חזיתות:`,
      `• איראן: ${fronts.iran.status} (${fronts.iran.mentions} אזכורים, סיכון ${fronts.iran.risk})`,
      `• לבנון: ${fronts.lebanon.status} (${fronts.lebanon.mentions} אזכורים, סיכון ${fronts.lebanon.risk})`,
      `• עזה: ${fronts.gaza.status} (${fronts.gaza.mentions} אזכורים, סיכון ${fronts.gaza.risk})`,
      `• תימן: ${fronts.yemen.status} (${fronts.yemen.mentions} אזכורים, סיכון ${fronts.yemen.risk})`,
      ``,
      `המלצות:\n${recommendations.join('\n')}`,
    ].join('\n');

    // Upsert report
    const { data, error } = await sb.from('daily_intel_reports').upsert({
      report_date: reportDate,
      summary,
      threat_level: threatLevel,
      fronts,
      key_findings: keyFindings,
      source_stats: sourceStats,
      recommendations,
      raw_data: {
        launch_detections: launchDetections.slice(0, 10),
        leader_statements: leaderStatements.slice(0, 10),
        critical_events: criticalEvents.slice(0, 10).map(e => ({ title: e.title, source: e.source, score: e.score, time: e.created_at })),
        oref_locations: orefAlerts.flatMap(a => a.locations || []).slice(0, 20),
        critical_telegram: criticalTelegram.slice(0, 10).map(m => ({ text: (m.text || '').slice(0, 100), bot: m.bot_name, time: m.created_at })),
      },
    }, { onConflict: 'report_date' }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, report: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
