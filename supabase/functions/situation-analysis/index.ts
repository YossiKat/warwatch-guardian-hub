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

    // Gather data from ALL sources — wider time window for better analysis
    const since1h = new Date(Date.now() - 3600000).toISOString();
    const since6h = new Date(Date.now() - 6 * 3600000).toISOString();
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();

    const [
      { data: intelRecent },
      { data: intel6h },
      { data: events },
      { data: oref },
      { data: telegram },
      { data: oref24h },
    ] = await Promise.all([
      supabase.from('intel_reports').select('title,summary,severity,category,region,source,tags,created_at').gte('created_at', since1h).order('created_at', { ascending: false }).limit(50),
      supabase.from('intel_reports').select('title,summary,severity,category,region,source,tags,created_at').gte('created_at', since6h).order('created_at', { ascending: false }).limit(100),
      supabase.from('emergency_events').select('title,description,location,color,score,source,created_at').gte('created_at', since1h).order('created_at', { ascending: false }).limit(30),
      supabase.from('oref_alerts').select('title,description,locations,category,alert_date').gte('alert_date', since1h).order('alert_date', { ascending: false }).limit(30),
      supabase.from('telegram_messages').select('text,severity,tags,sender_name,chat_id,created_at').eq('is_duplicate', false).gte('created_at', since6h).order('created_at', { ascending: false }).limit(80),
      supabase.from('oref_alerts').select('title,locations,category,alert_date').gte('alert_date', since24h).order('alert_date', { ascending: false }).limit(50),
    ]);

    // Build comprehensive briefing organized by source type
    const briefing = [
      '=== התראות פיקוד העורף (שעה אחרונה) ===',
      ...(oref || []).map(a => `[${a.alert_date}] ${a.title} | אזורים: ${(a.locations || []).join(', ')} | ${a.description || ''}`),
      `=== התראות 24 שעות (${oref24h?.length || 0} סה"כ) ===`,
      ...(oref24h || []).slice(0, 10).map(a => `${a.title} | ${(a.locations || []).join(', ')}`),
      '',
      '=== דיווחי מודיעין — שעה אחרונה ===',
      ...(intelRecent || []).map(r => `[${r.severity}][${r.source}] ${r.title} — ${r.summary}`),
      '',
      '=== דיווחי מודיעין — 6 שעות (מגמות) ===',
      ...(intel6h || []).filter(r => r.severity === 'critical' || r.severity === 'high').map(r => `[${r.severity}][${r.source}] ${r.title}`),
      '',
      '=== אירועי חירום ===',
      ...(events || []).map(e => `[${e.color}/${e.score}] ${e.title} — ${e.description || ''} @ ${e.location || ''}`),
      '',
      '=== טלגרם (כל הערוצים — ייחודיים בלבד) ===',
      ...(telegram || []).map(m => `[${m.severity}][${m.sender_name || 'unknown'}] ${m.text?.slice(0, 250)}`),
      '',
      `סה"כ נקודות מידע: intel=${(intelRecent?.length || 0)+(intel6h?.length || 0)}, alerts=${oref?.length || 0}, emergency=${events?.length || 0}, telegram=${telegram?.length || 0}`,
      `ערוצים פעילים: ${new Set((intel6h || []).map(r => r.source)).size}`,
      `מקורות: ${[...new Set((intel6h || []).map(r => r.source))].join(', ')}`,
    ].join('\n');

    const systemPrompt = `אתה קצין מודיעין ראשי בחדר מלחמה ישראלי. תפקידך לנתח את כל הנתונים ממכלול ערוצי המודיעין — כולל:
- רויטרס, BBC, CNN, Fox News, אלג'זירה (ערוצים בינלאומיים)
- IRNA, תסנים, פארס (ערוצים איראניים)
- ערוץ 12, ערוץ 13, כאן 11, ynet, וואלה (ערוצים ישראליים)
- Wall Street Journal, New York Times, Financial Times, Bloomberg (עיתונות בינלאומית/כלכלית)
- CENTCOM, NATO (גופים צבאיים)
- Gulf News, Arab News, The National (מדינות המפרץ — איחוד האמירויות, סעודיה, בחריין, קאטר)
- RT, TASS (רוסיה), SCMP, Xinhua (סין) — מעורבות מעצמות בסכסוך
- פיקוד העורף, מד"א, משטרה, כיבוי (גופי חירום)
- טלגרם (ערוצי מודיעין שטח)

עליך:
1. לסרוק ולנתח את כל הנתונים — כולל מילות מפתח בעברית, ערבית ואנגלית
2. **קריטי: זיהוי שיגורים** — חפש סימנים לזיהוי שיגור, התרעת שיגור, שיגור מאיראן, שיגור בליסטי, כוננות שיגור, העברת טילים, טעינת משגרים, גילוי מוקדם. כל סימן כזה הוא בעדיפות עליונה.
3. **קריטי: הצהרות מנהיגים** — נתח הצהרות מחמינאי, פזשכיאן, נסראללה, משמרות המהפכה (IRGC), חיל קודס, מנהיגי חמאס (סינוואר, הנייה). נתח גם הצהרות ממנהיגי עולם (טראמפ, ביידן, מקרון, שולץ, ארדואן). שים לב במיוחד לאיומים ישירים, הצהרות נקמה/גמול/תגמול, ותגובות קשות.
4. לזהות דפוסים, קורלציות בין מקורות, וסתירות
5. לנתח את עמדות מדינות המפרץ (UAE, סעודיה, בחריין, קאטר) ביחס לעימות
6. לנתח את מעורבות רוסיה וסין — תמיכה דיפלומטית, ויטו, מכירת נשק
7. לנתח השפעות כלכליות — מחירי נפט, מסחר, שרשראות אספקה, שווקים
8. לייצר תחזית מדויקת לשלוש תקופות: שעה קרובה, יום קרוב, שבוע קרוב
9. לדרג חזיתות (צפון, דרום, יו"ש, ים, פנים, איראן, מפרץ, בינלאומי, כלכלי)
10. לתת המלצות פעולה
11. **חיזוי מוקדם**: על בסיס הצהרות מנהיגים + תנועות צבאיות + מודיעין שטח — הערך סבירות לשיגור/מתקפה בכל אחת מהחזיתות

מילות מפתח קריטיות לחיפוש בנתונים:
עברית: זיהוי שיגור, שיגור מאיראן, שיגור בליסטי, כוננות שיגור, התראה לפני שיגור, חמינאי, נסראללה, משמרות המהפכה, איום ישיר, נקמה, מתקפת תגמול
ערבית: إطلاق صواريخ, إطلاق باليستي, رصد إطلاق, خامنئي, نصر الله, الحرس الثوري, تهديد مباشر, انتقام, ضربة انتقامية
אנגלית: Launch detection, Missile launch, Ballistic launch, Khamenei, Nasrallah, IRGC, Retaliation, Retaliatory strike

כל התשובות חייבות להיות בעברית מקצועית ותמציתית. השתמש בפורמט הכלי (tool call).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `נתח את כל הנתונים הבאים וייצר הערכת מצב מקיפה עם תחזיות:\n\n${briefing}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'situation_assessment',
            description: 'Structured situation assessment with multi-timeframe forecasts',
            parameters: {
              type: 'object',
              properties: {
                overall_threat: { type: 'string', enum: ['critical', 'high', 'elevated', 'moderate', 'low'] },
                bottom_line: { type: 'string', description: 'שורה תחתונה — משפט אחד שמסכם את המצב' },
                summary: { type: 'string', description: 'סיכום מצב כללי ב-3-4 משפטים בעברית' },
                fronts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'שם החזית: צפון/דרום/יו"ש/ים/פנים/איראן/בינלאומי' },
                      threat_level: { type: 'number', description: '0-100' },
                      status: { type: 'string', description: 'סטטוס קצר בעברית' },
                      trend: { type: 'string', enum: ['escalating', 'stable', 'de-escalating'] },
                    },
                    required: ['name', 'threat_level', 'status', 'trend'],
                  },
                },
                forecast_hour: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'כותרת תחזית לשעה הקרובה' },
                    details: { type: 'string', description: 'פירוט תחזית שעה — 2-3 משפטים' },
                    risk_level: { type: 'number', description: '0-100 רמת סיכון' },
                    key_events: { type: 'array', items: { type: 'string' }, description: 'אירועים צפויים' },
                  },
                  required: ['title', 'details', 'risk_level'],
                },
                forecast_day: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'כותרת תחזית ליום הקרוב' },
                    details: { type: 'string', description: 'פירוט תחזית יום — 2-3 משפטים' },
                    risk_level: { type: 'number', description: '0-100' },
                    key_events: { type: 'array', items: { type: 'string' }, description: 'אירועים צפויים' },
                  },
                  required: ['title', 'details', 'risk_level'],
                },
                forecast_week: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'כותרת תחזית לשבוע הקרוב' },
                    details: { type: 'string', description: 'פירוט תחזית שבוע — 2-3 משפטים' },
                    risk_level: { type: 'number', description: '0-100' },
                    key_events: { type: 'array', items: { type: 'string' }, description: 'מגמות צפויות' },
                  },
                  required: ['title', 'details', 'risk_level'],
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'המלצות פעולה בעברית',
                },
                source_analysis: {
                  type: 'string',
                  description: 'ניתוח קצר של המקורות — מי מדווח מה, סתירות, מגמות בין ערוצים',
                },
                key_actors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      role: { type: 'string' },
                      intent: { type: 'string', enum: ['hostile', 'neutral', 'supportive'] },
                    },
                    required: ['name', 'role', 'intent'],
                  },
                },
              },
              required: ['overall_threat', 'bottom_line', 'summary', 'fronts', 'forecast_hour', 'forecast_day', 'forecast_week', 'recommendations'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'situation_assessment' } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI error:', response.status, t);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, try again later' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // For 402 (credits exhausted) or 5xx, return a fallback assessment instead of crashing
      if (response.status === 402 || response.status >= 500) {
        const fallback = {
          ok: true,
          assessment: {
            overall_threat: 'moderate',
            bottom_line: 'שירות הניתוח אינו זמין כרגע — הנתונים הגולמיים מוצגים.',
            summary: response.status === 402
              ? 'יתרת הקרדיטים של שירות ה-AI נגמרה. נא להוסיף קרדיטים בהגדרות.'
              : 'שירות ה-AI אינו זמין זמנית. מציג נתונים גולמיים.',
            fronts: [],
            forecast_hour: { title: 'לא זמין', details: 'שירות הניתוח אינו פעיל', risk_level: 0 },
            forecast_day: { title: 'לא זמין', details: 'שירות הניתוח אינו פעיל', risk_level: 0 },
            forecast_week: { title: 'לא זמין', details: 'שירות הניתוח אינו פעיל', risk_level: 0 },
            recommendations: ['בדוק יתרת קרדיטים בהגדרות'],
            generated_at: new Date().toISOString(),
            data_points: 0,
            active_sources: 0,
            fallback: true,
          },
        };
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let assessment: any = null;

    if (toolCall?.function?.arguments) {
      try {
        assessment = JSON.parse(toolCall.function.arguments);
      } catch {
        assessment = null;
      }
    }

    if (!assessment) {
      const content = aiData.choices?.[0]?.message?.content || '';
      assessment = {
        overall_threat: 'moderate',
        bottom_line: 'לא ניתן לייצר הערכת מצב כרגע — ממתין לנתונים נוספים.',
        summary: content || 'אין מספיק נתונים לניתוח.',
        fronts: [],
        forecast_hour: { title: 'ממתין', details: 'אין מספיק נתונים', risk_level: 0 },
        forecast_day: { title: 'ממתין', details: 'אין מספיק נתונים', risk_level: 0 },
        forecast_week: { title: 'ממתין', details: 'אין מספיק נתונים', risk_level: 0 },
        recommendations: ['המתן לנתונים נוספים'],
      };
    }

    assessment.generated_at = new Date().toISOString();
    assessment.data_points = (intelRecent?.length || 0) + (intel6h?.length || 0) + (events?.length || 0) + (oref?.length || 0) + (telegram?.length || 0);
    assessment.active_sources = [...new Set((intel6h || []).map(r => r.source))].length;

    return new Response(JSON.stringify({ ok: true, assessment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Situation analysis error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
