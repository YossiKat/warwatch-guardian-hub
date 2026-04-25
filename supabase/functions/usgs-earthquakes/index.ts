import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// USGS Earthquake API - completely free, no key needed
// GeoJSON feed updated every minute
const USGS_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';

// Middle East bounding box
const BBOX = { minLat: 12, maxLat: 42, minLon: 30, maxLon: 65 };

interface QuakeFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    title: string;
    type: string;
    tsunami: number;
    sig: number; // significance 0-1000
    alert: string | null;
  };
  geometry: {
    coordinates: [number, number, number]; // lon, lat, depth
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Fetch all earthquakes in last hour (M1.0+)
    // Also fetch significant in last day for context
    const [hourResp, dayResp] = await Promise.all([
      fetch(`${USGS_BASE}/all_hour.geojson`),
      fetch(`${USGS_BASE}/significant_day.geojson`),
    ]);

    if (!hourResp.ok) throw new Error(`USGS hour feed error: ${hourResp.status}`);
    if (!dayResp.ok) throw new Error(`USGS day feed error: ${dayResp.status}`);

    const hourData = await hourResp.json();
    const dayData = await dayResp.json();

    // Filter to Middle East region
    const filterRegion = (features: QuakeFeature[]) =>
      features.filter(f => {
        const [lon, lat] = f.geometry.coordinates;
        return lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;
      });

    const hourQuakes = filterRegion(hourData.features || []);
    const daySignificant = filterRegion(dayData.features || []);

    // Merge and deduplicate
    const allIds = new Set<string>();
    const allQuakes: QuakeFeature[] = [];
    
    for (const q of [...daySignificant, ...hourQuakes]) {
      if (!allIds.has(q.id)) {
        allIds.add(q.id);
        allQuakes.push(q);
      }
    }

    // Classify each quake
    const classified = allQuakes.map(q => ({
      id: q.id,
      magnitude: q.properties.mag,
      place: q.properties.place,
      time: new Date(q.properties.time).toISOString(),
      lat: q.geometry.coordinates[1],
      lon: q.geometry.coordinates[0],
      depth_km: q.geometry.coordinates[2],
      significance: q.properties.sig,
      tsunami: q.properties.tsunami > 0,
      alert: q.properties.alert,
      url: q.properties.url,
      region: classifyRegion(q.geometry.coordinates[1], q.geometry.coordinates[0]),
      severity: classifySeverity(q.properties.mag, q.geometry.coordinates[2]),
      possible_explosion: isPossibleExplosion(q.properties.mag, q.geometry.coordinates[2], q.properties.type),
    }));

    // Store significant quakes or possible explosions in intel
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const notable = classified.filter(q => q.magnitude >= 3.0 || q.possible_explosion);

    for (const q of notable.slice(0, 5)) {
      const emoji = q.possible_explosion ? '💥' : '🌍';
      const sev = q.possible_explosion ? 'critical' : (q.magnitude >= 5 ? 'high' : 'medium');
      
      // Check for duplicates in last hour
      const { data: existing } = await supabase
        .from('intel_reports')
        .select('id')
        .eq('source', 'usgs_earthquake')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .ilike('title', `%${q.id}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('intel_reports').insert({
        title: `${emoji} רעידה M${q.magnitude} — ${q.region}${q.possible_explosion ? ' [חשד לפיצוץ]' : ''}`,
        summary: `עוצמה: M${q.magnitude} | עומק: ${q.depth_km.toFixed(1)} ק"מ | ${q.place} | ${q.possible_explosion ? '⚠️ עומק רדוד מחשיד — ייתכן פיצוץ תת-קרקעי' : 'רעידת אדמה טבעית'}`,
        category: q.possible_explosion ? 'military' : 'geopolitical',
        source: 'usgs_earthquake',
        severity: sev,
        region: q.region,
        tags: ['satellite', 'earthquake', 'usgs', ...(q.possible_explosion ? ['explosion', 'suspicious'] : [])],
        raw_data: q,
      });
    }

    console.log(`USGS: ${allQuakes.length} quakes in region, ${notable.length} notable`);

    return new Response(JSON.stringify({
      ok: true,
      earthquakes: classified,
      count: classified.length,
      notable: notable.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('USGS error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function classifyRegion(lat: number, lon: number): string {
  if (lat >= 29 && lat <= 33.5 && lon >= 34 && lon <= 36) return 'ישראל';
  if (lat >= 33 && lat <= 35 && lon >= 35 && lon <= 37) return 'לבנון';
  if (lat >= 32 && lat <= 37 && lon >= 35.5 && lon <= 42) return 'סוריה';
  if (lat >= 25 && lat <= 38 && lon >= 43 && lon <= 63) return 'איראן';
  if (lat >= 12 && lat <= 19 && lon >= 42 && lon <= 55) return 'תימן';
  if (lat >= 29 && lat <= 37 && lon >= 38 && lon <= 49) return 'עיראק';
  return 'מזרח תיכון';
}

function classifySeverity(mag: number, depth: number): string {
  if (mag >= 6) return 'critical';
  if (mag >= 4.5) return 'high';
  if (mag >= 3) return 'medium';
  return 'low';
}

// Shallow quakes (< 5km) with specific magnitudes could be underground explosions
function isPossibleExplosion(mag: number, depth: number, type: string): boolean {
  if (type === 'explosion' || type === 'nuclear explosion') return true;
  // Very shallow + moderate magnitude = suspicious
  if (depth < 5 && mag >= 2.5 && mag <= 6.0) return true;
  return false;
}
