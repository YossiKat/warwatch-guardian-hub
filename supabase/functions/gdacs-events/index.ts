// GDACS — Global Disaster Alert and Coordination System (free RSS, no key)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';

// Naive XML field extractor for RSS items
function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
function pick(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = xml.match(re);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

interface GdacsEvent {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  lat: number | null;
  lon: number | null;
  category: 'earthquake' | 'cyclone' | 'flood' | 'volcano' | 'drought' | 'wildfire' | 'other';
  severity: 'green' | 'orange' | 'red';
  country?: string;
}

const CAT_MAP: Record<string, GdacsEvent['category']> = {
  EQ: 'earthquake', TC: 'cyclone', FL: 'flood',
  VO: 'volcano', DR: 'drought', WF: 'wildfire',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const r = await fetch(GDACS_RSS, {
      headers: { 'Accept': 'application/rss+xml,application/xml,text/xml' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: `GDACS HTTP ${r.status}`, events: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const xml = await r.text();
    const items = pickAll(xml, 'item');
    const events: GdacsEvent[] = [];

    for (const item of items) {
      const title = pick(item, 'title');
      const desc = pick(item, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const link = pick(item, 'link');
      const pubDate = pick(item, 'pubDate');
      const guid = pick(item, 'guid') || link;

      // GDACS uses geo:Point with geo:lat / geo:long, plus gdacs:eventtype + gdacs:alertlevel
      const latRaw = pick(item, 'geo:lat') || pick(item, 'geo:Point') || '';
      const lonRaw = pick(item, 'geo:long') || '';
      const lat = parseFloat(latRaw);
      const lon = parseFloat(lonRaw);

      const evType = (pick(item, 'gdacs:eventtype') || '').toUpperCase();
      const alert = (pick(item, 'gdacs:alertlevel') || 'green').toLowerCase();
      const country = pick(item, 'gdacs:country') || pick(item, 'gdacs:countryname') || '';

      events.push({
        id: guid,
        title,
        description: desc.slice(0, 280),
        link,
        pubDate,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        category: CAT_MAP[evType] || 'other',
        severity: alert === 'red' ? 'red' : alert === 'orange' ? 'orange' : 'green',
        country: country || undefined,
      });
    }

    return new Response(JSON.stringify({ ok: true, count: events.length, events }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('GDACS error:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e), events: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
