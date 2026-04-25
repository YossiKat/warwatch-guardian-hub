import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const CITIES = [
  { city: 'תל אביב', lat: 32.0853, lon: 34.7818 },
  { city: 'ירושלים', lat: 31.7683, lon: 35.2137 },
  { city: 'חיפה', lat: 32.7940, lon: 34.9896 },
  { city: 'באר שבע', lat: 31.2530, lon: 34.7915 },
  { city: 'אשדוד', lat: 31.8014, lon: 34.6436 },
  { city: 'אשקלון', lat: 31.6688, lon: 34.5743 },
  { city: 'נתניה', lat: 32.3215, lon: 34.8532 },
  { city: 'שדרות', lat: 31.5250, lon: 34.5953 },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const TOMTOM_KEY = Deno.env.get('TOMTOM_API_KEY');
  if (!TOMTOM_KEY) {
    return new Response(JSON.stringify({ error: 'TOMTOM_API_KEY not configured', ok: false }), {
      status: 200, // Return 200 so UI doesn't break
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const results: Array<{ city: string; status: string; speed: number }> = [];

  for (const { city, lat, lon } of CITIES) {
    try {
      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${TOMTOM_KEY}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      
      const speed = data?.flowSegmentData?.currentSpeed || 0;
      const freeFlow = data?.flowSegmentData?.freeFlowSpeed || 1;
      const ratio = speed / freeFlow;
      const status = ratio < 0.4 ? 'HEAVY' : ratio < 0.7 ? 'MEDIUM' : 'LIGHT';

      await supabase
        .from('traffic_status')
        .upsert({
          city,
          lat,
          lon,
          current_speed: speed,
          free_flow_speed: freeFlow,
          status,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'city' });

      results.push({ city, status, speed });
    } catch (e) {
      results.push({ city, status: 'ERROR', speed: 0 });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
