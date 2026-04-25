import { corsHeaders } from '@supabase/supabase-js/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { zone, isGlobal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    const system = isGlobal
      ? `אתה מנתח מודיעין גלובלי. בצע סקירת מצב עולמי כוללת.
ניתח: אוקראינה-רוסיה, עזה-ישראל, טייוואן-סין, קוריאה הצפונית, ים סוף, מיאנמר, סודן, סאהל.
החזר JSON תקין בלבד עם המבנה הנדרש.`
      : `אתה מערכת מודיעין גיאוסטרטגית. נתח את הסכסוך: ${zone.name}.
גורמים: ${zone.parties.join(', ')}. תגיות: ${zone.tags.join(', ')}.
חפש מצב צבאי עדכני, מדיני-דיפלומטי, גיאופוליטיקה, אסונות הומניטריים, ומגמות 30 יום.
החזר JSON תקין בלבד.`;

    const userMsg = isGlobal
      ? `דוח גלובלי כולל — ${new Date().toLocaleString('he-IL')}.`
      : `ניתוח מצב עדכני — ${zone.name} — ${new Date().toLocaleString('he-IL')}.`;

    const tool = {
      type: 'function',
      function: {
        name: 'intel_report',
        description: 'Strategic intelligence report',
        parameters: {
          type: 'object',
          properties: {
            riskLevel: { type: 'number' },
            riskReason: { type: 'string' },
            readinessScore: { type: 'number' },
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'high', 'warning', 'medium', 'low'] },
                  earlyWarning: { type: 'boolean' },
                  confidence: { type: 'number' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['id', 'title', 'body', 'severity'],
              },
            },
            diplomatic: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  country: { type: 'string' },
                  flag: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  trend: { type: 'string' },
                  trendColor: { type: 'string' },
                },
                required: ['country', 'status'],
              },
            },
            military: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  unit: { type: 'string' },
                  action: { type: 'string' },
                  location: { type: 'string' },
                  significance: { type: 'string' },
                },
                required: ['unit', 'action'],
              },
            },
            disasters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  icon: { type: 'string' },
                  title: { type: 'string' },
                  detail: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
                  affected: { type: 'number' },
                },
                required: ['title', 'severity'],
              },
            },
            report: {
              type: 'object',
              properties: {
                situation: { type: 'string' },
                military: { type: 'string' },
                diplomatic: { type: 'string' },
                outlook: { type: 'string' },
                keyRisk: { type: 'string' },
              },
            },
          },
          required: ['riskLevel', 'alerts', 'report'],
        },
      },
    };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'intel_report' } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      throw new Error('AI gateway error');
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('global-war-scan error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
