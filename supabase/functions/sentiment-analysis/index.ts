import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (!lovableKey) throw new Error('LOVABLE_API_KEY not configured');

    const since2h = new Date(Date.now() - 2 * 3600000).toISOString();

    // Gather recent data from all sources
    const [
      { data: intelReports },
      { data: orefAlerts },
      { data: telegramMsgs },
      { data: emergencyEvents },
    ] = await Promise.all([
      supabase.from('intel_reports').select('title,summary,severity,source,created_at')
        .gte('created_at', since2h).order('created_at', { ascending: false }).limit(60),
      supabase.from('oref_alerts').select('title,locations,category,alert_date')
        .gte('alert_date', since2h).order('alert_date', { ascending: false }).limit(30),
      supabase.from('telegram_messages').select('text,severity,created_at')
        .eq('is_duplicate', false).not('text', 'is', null)
        .gte('created_at', since2h).order('created_at', { ascending: false }).limit(40),
      supabase.from('emergency_events').select('title,color,score,created_at')
        .gte('created_at', since2h).order('created_at', { ascending: false }).limit(20),
    ]);

    const headlines: string[] = [];
    const sources = new Set<string>();

    (intelReports || []).forEach(r => {
      headlines.push(`[${r.severity}][${r.source}] ${r.title}`);
      sources.add(r.source);
    });
    (orefAlerts || []).forEach(a => {
      headlines.push(`[OREF] ${a.title} — ${(a.locations || []).join(', ')}`);
      sources.add('oref');
    });
    (telegramMsgs || []).forEach(m => {
      if (m.text && m.text.length > 10) {
        headlines.push(`[TG][${m.severity}] ${m.text.slice(0, 150)}`);
        sources.add('telegram');
      }
    });
    (emergencyEvents || []).forEach(e => {
      headlines.push(`[EMERGENCY][${e.color}] ${e.title}`);
      sources.add('emergency');
    });

    if (headlines.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No data to analyze' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headlinesBlock = headlines.slice(0, 80).join('\n');

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 25000);
    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      signal: aiController.signal,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `אתה מנתח סנטימנט ביטחוני. קבל רשימת כותרות חדשותיות ודרג את הסנטימנט הכולל על סקאלה של -100 (הרגעה מוחלטת, שקט, הפסקת אש) ל-+100 (הסלמה קיצונית, מלחמה פתוחה).
0 = ניטרלי / שגרתי.
השתמש בפורמט הכלי.`,
          },
          {
            role: 'user',
            content: `נתח את הסנטימנט הביטחוני מהכותרות הבאות (${headlines.length} כותרות מ-${sources.size} מקורות, שעתיים אחרונות):\n\n${headlinesBlock}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'sentiment_score',
            description: 'Rate the overall security sentiment',
            parameters: {
              type: 'object',
              properties: {
                score: { type: 'integer', description: '-100 (הרגעה) to +100 (הסלמה)' },
                label: { type: 'string', description: 'תיאור קצר בעברית: "הרגעה", "שגרה", "מתיחות", "הסלמה", "הסלמה חריפה"' },
                escalation_drivers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '3 גורמי הסלמה עיקריים (אם יש)',
                },
                deescalation_signals: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'סימני הרגעה (אם יש)',
                },
                trend_direction: { type: 'string', enum: ['escalating', 'stable', 'de-escalating'] },
              },
              required: ['score', 'label', 'trend_direction'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'sentiment_score' } },
      }),
      });
    } catch (e) {
      clearTimeout(aiTimeout);
      console.error('AI fetch failed/timed out:', e);
      const { data: history } = await supabase
        .from('sentiment_scores')
        .select('score,label,data_points,sources,created_at,raw_data')
        .order('created_at', { ascending: false })
        .limit(48);
      return new Response(JSON.stringify({
        ok: false,
        degraded: true,
        reason: 'AI_TIMEOUT',
        message: 'שירות הניתוח לא הגיב בזמן — מציג היסטוריה אחרונה.',
        current: { score: 0, label: 'ניתוח מושהה', trend_direction: 'stable' },
        history: (history || []).reverse(),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    clearTimeout(aiTimeout);

    if (!response.ok) {
      const t = await response.text().catch(() => '');
      console.error('AI error:', response.status, t);

      // Graceful fallback — never crash the client. Return last known history.
      const { data: history } = await supabase
        .from('sentiment_scores')
        .select('score,label,data_points,sources,created_at,raw_data')
        .order('created_at', { ascending: false })
        .limit(48);

      const reason = response.status === 402
        ? 'AI_CREDITS_EXHAUSTED'
        : response.status === 429
          ? 'AI_RATE_LIMITED'
          : `AI_ERROR_${response.status}`;

      return new Response(JSON.stringify({
        ok: false,
        degraded: true,
        reason,
        message: response.status === 402
          ? 'נגמרו קרדיטים של Lovable AI — הניתוח מושהה. הוסף קרדיטים ב-Settings → Workspace → Usage.'
          : response.status === 429
            ? 'יותר מדי בקשות ל-AI — נסה שוב בעוד דקה.'
            : 'שירות הניתוח אינו זמין כרגע.',
        current: { score: 0, label: 'ניתוח מושהה', trend_direction: 'stable' },
        history: (history || []).reverse(),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiText = await response.text();
    let aiData: any;
    try {
      aiData = JSON.parse(aiText);
    } catch {
      console.error('AI returned non-JSON:', aiText.slice(0, 500));
      aiData = {};
    }

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = null;

    if (toolCall?.function?.arguments) {
      const raw = toolCall.function.arguments;
      try {
        result = JSON.parse(raw);
      } catch {
        // Try to extract JSON from potentially malformed string
        const objStart = raw.indexOf('{');
        const objEnd = raw.lastIndexOf('}');
        if (objStart !== -1 && objEnd > objStart) {
          try { result = JSON.parse(raw.slice(objStart, objEnd + 1)); } catch { /* ignore */ }
        }
      }
    }

    // Fallback: try content text if no tool call
    if (!result) {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const m = content.match(/\{[\s\S]*\}/);
          if (m) result = JSON.parse(m[0]);
        } catch { /* ignore */ }
      }
    }

    if (!result || typeof result.score !== 'number') {
      result = { score: 0, label: 'לא ניתן לנתח', trend_direction: 'stable' };
    }

    // Store the score
    const { error: insertErr } = await supabase.from('sentiment_scores').insert({
      score: Math.max(-100, Math.min(100, result.score)),
      label: result.label,
      data_points: headlines.length,
      top_headlines: headlines.slice(0, 5),
      sources: [...sources],
      analysis_window: '2h',
      raw_data: {
        escalation_drivers: result.escalation_drivers || [],
        deescalation_signals: result.deescalation_signals || [],
        trend_direction: result.trend_direction,
      },
    });

    if (insertErr) console.error('Insert error:', insertErr);

    // Return recent history for charting
    const { data: history } = await supabase
      .from('sentiment_scores')
      .select('score,label,data_points,sources,created_at,raw_data')
      .order('created_at', { ascending: false })
      .limit(48); // 48 data points = ~24h if running every 30min

    return new Response(JSON.stringify({
      ok: true,
      current: result,
      history: (history || []).reverse(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
