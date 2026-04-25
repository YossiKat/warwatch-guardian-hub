// TomTom Traffic Flow tile proxy — keeps API key server-side
// URL pattern: /tomtom-traffic-tile/{style}/{z}/{x}/{y}.png
// styles: relative0, relative-dark, absolute, reduced-sensitivity

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const ALLOWED_STYLES = new Set([
  'relative0',
  'relative-dark',
  'absolute',
  'reduced-sensitivity',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('TOMTOM_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TOMTOM_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    // Path looks like: /tomtom-traffic-tile/{style}/{z}/{x}/{y}.png
    const parts = url.pathname.split('/').filter(Boolean);
    // drop function name
    const idx = parts.indexOf('tomtom-traffic-tile');
    const tail = idx >= 0 ? parts.slice(idx + 1) : parts;

    if (tail.length < 4) {
      return new Response(JSON.stringify({ error: 'Bad path. Expect /{style}/{z}/{x}/{y}.png' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [style, zStr, xStr, yRaw] = tail;
    if (!ALLOWED_STYLES.has(style)) {
      return new Response(JSON.stringify({ error: 'Invalid style' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const y = yRaw.replace(/\.(png|jpg|jpeg)$/i, '');
    const z = parseInt(zStr, 10);
    const x = parseInt(xStr, 10);
    const yi = parseInt(y, 10);
    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(yi) || z < 0 || z > 22) {
      return new Response(JSON.stringify({ error: 'Invalid tile coords' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${z}/${x}/${yi}.png?key=${apiKey}`;
    const r = await fetch(upstream);
    if (!r.ok) {
      const body = await r.text();
      console.error(`TomTom ${r.status} for ${style}/${z}/${x}/${yi}: ${body.slice(0, 300)}`);
      return new Response(JSON.stringify({ error: `TomTom ${r.status}`, detail: body.slice(0, 300) }), {
        status: r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
