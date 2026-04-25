import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NASA EONET (Earth Observatory Natural Event Tracker) - free, no key needed
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';

// Middle East bounding box
const BBOX = { minLat: 12, maxLat: 42, minLon: 30, maxLon: 65 };

interface EONETEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  closed: string | null;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: { date: string; type: string; coordinates: number[] }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Fetch active events in last 30 days
    const url = `${EONET_URL}?status=open&days=30&bbox=${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon},${BBOX.minLat}`;
    
    console.log('Fetching NASA EONET data...');
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`EONET primary API error: ${response.status}`);
      // Fallback without bbox filter
      const fallbackUrl = `${EONET_URL}?status=open&days=7`;
      try {
        const fallbackResp = await fetch(fallbackUrl);
        if (!fallbackResp.ok) {
          // Both endpoints failed — return empty gracefully
          return new Response(JSON.stringify({ ok: false, error: 'SERVICE_UNAVAILABLE', fallback: true, events: [], count: 0 }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const fallbackData = await fallbackResp.json();
        const filtered = filterToRegion(fallbackData.events || []);
        return new Response(JSON.stringify({ ok: true, events: filtered, count: filtered.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'SERVICE_UNAVAILABLE', fallback: true, events: [], count: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const data = await response.json();
    const events: EONETEvent[] = data.events || [];

    // Process events
    const classified = events.map(e => {
      const latestGeo = e.geometry[e.geometry.length - 1];
      const coords = latestGeo?.coordinates || [];
      const lon = coords[0] || 0;
      const lat = coords[1] || 0;
      const category = e.categories[0]?.id || 'unknown';

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        category,
        categoryName: e.categories[0]?.title || 'Unknown',
        lat,
        lon,
        date: latestGeo?.date || '',
        closed: e.closed,
        link: e.link,
        region: classifyRegion(lat, lon),
        icon: getCategoryIcon(category),
        severity: getCategorySeverity(category),
      };
    });

    // Store in intel_reports
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const e of classified.slice(0, 5)) {
      // Check duplicates
      const { data: existing } = await supabase
        .from('intel_reports')
        .select('id')
        .eq('source', 'nasa_eonet')
        .ilike('title', `%${e.id}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('intel_reports').insert({
        title: `${e.icon} EONET: ${e.title}`,
        summary: `קטגוריה: ${e.categoryName} | מיקום: ${e.lat.toFixed(2)}, ${e.lon.toFixed(2)} | אזור: ${e.region} | ${e.description || 'ללא תיאור נוסף'}`,
        category: 'satellite',
        source: 'nasa_eonet',
        severity: e.severity,
        region: e.region,
        tags: ['satellite', 'eonet', e.category, 'natural_event'],
        raw_data: e,
      });
    }

    console.log(`EONET: ${events.length} active events in region`);

    return new Response(JSON.stringify({
      ok: true,
      events: classified,
      count: classified.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('EONET error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'SERVICE_FAILED', fallback: true, events: [], count: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function filterToRegion(events: EONETEvent[]): any[] {
  return events.filter(e => {
    const latestGeo = e.geometry[e.geometry.length - 1];
    if (!latestGeo) return false;
    const [lon, lat] = latestGeo.coordinates;
    return lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;
  }).map(e => {
    const latestGeo = e.geometry[e.geometry.length - 1];
    const [lon, lat] = latestGeo.coordinates;
    return {
      id: e.id, title: e.title, lat, lon,
      category: e.categories[0]?.id || 'unknown',
      categoryName: e.categories[0]?.title || 'Unknown',
      date: latestGeo.date, region: classifyRegion(lat, lon),
      icon: getCategoryIcon(e.categories[0]?.id || ''),
      severity: getCategorySeverity(e.categories[0]?.id || ''),
    };
  });
}

function classifyRegion(lat: number, lon: number): string {
  if (lat >= 29 && lat <= 33.5 && lon >= 34 && lon <= 36) return 'ישראל';
  if (lat >= 33 && lat <= 35 && lon >= 35 && lon <= 37) return 'לבנון';
  if (lat >= 32 && lat <= 37 && lon >= 35.5 && lon <= 42) return 'סוריה';
  if (lat >= 25 && lat <= 38 && lon >= 43 && lon <= 63) return 'איראן';
  if (lat >= 12 && lat <= 19 && lon >= 42 && lon <= 55) return 'תימן';
  if (lat >= 29 && lat <= 37 && lon >= 38 && lon <= 49) return 'עיראק';
  return 'מזרח תיכון';
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    wildfires: '🔥',
    volcanoes: '🌋',
    earthquakes: '🌍',
    floods: '🌊',
    severeStorms: '⛈️',
    dustHaze: '🌫️',
    landslides: '🏔️',
    snow: '❄️',
    tempExtremes: '🌡️',
    seaLakeIce: '🧊',
    manmade: '⚠️',
  };
  return icons[category] || '🛰️';
}

function getCategorySeverity(category: string): string {
  const critical = ['volcanoes', 'earthquakes', 'manmade'];
  const high = ['wildfires', 'severeStorms', 'floods'];
  if (critical.includes(category)) return 'critical';
  if (high.includes(category)) return 'high';
  return 'medium';
}
