import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NASA FIRMS - multiple satellite sources for maximum freshness
const FIRMS_SOURCES = [
  {
    name: 'VIIRS_SNPP_NRT',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
    satellite: 'SNPP',
  },
  {
    name: 'VIIRS_NOAA20_NRT',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv',
    satellite: 'NOAA20',
  },
  {
    name: 'MODIS_NRT',
    url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv',
    satellite: 'MODIS',
  },
];

// Middle East bounding box
const BBOX = {
  west: 30.0,
  south: 12.0,
  east: 65.0,
  north: 42.0,
};

// ── Known industrial / agricultural zones to EXCLUDE ──
// These are coordinates of oil refineries, gas flares, power plants, steel mills,
// agricultural burn areas, etc. that routinely produce thermal signatures.
// Each entry: { lat, lon, radius (degrees ~0.1=11km) }
const KNOWN_INDUSTRIAL_ZONES = [
  // Iran — oil/gas fields & refineries
  { lat: 30.35, lon: 49.30, r: 0.3, label: 'Abadan refinery' },
  { lat: 31.32, lon: 49.69, r: 0.2, label: 'Ahvaz oil fields' },
  { lat: 32.39, lon: 51.67, r: 0.2, label: 'Isfahan refinery' },
  { lat: 34.80, lon: 48.50, r: 0.2, label: 'Hamadan industrial' },
  { lat: 27.18, lon: 56.28, r: 0.3, label: 'Bandar Abbas refinery' },
  { lat: 26.55, lon: 54.35, r: 0.4, label: 'South Pars gas field' },
  { lat: 29.07, lon: 50.82, r: 0.3, label: 'Bushehr area' },
  { lat: 35.69, lon: 51.39, r: 0.15, label: 'Tehran industrial' },
  { lat: 30.28, lon: 48.30, r: 0.2, label: 'Mahshahr petrochemical' },
  { lat: 37.28, lon: 49.58, r: 0.2, label: 'Rasht industrial' },
  // Iraq — oil fields & refineries
  { lat: 30.50, lon: 47.80, r: 0.4, label: 'Basra oil fields' },
  { lat: 35.47, lon: 44.39, r: 0.3, label: 'Kirkuk oil fields' },
  { lat: 36.34, lon: 43.13, r: 0.2, label: 'Mosul industrial' },
  { lat: 34.60, lon: 43.68, r: 0.2, label: 'Baiji refinery' },
  { lat: 31.00, lon: 47.00, r: 0.3, label: 'Rumaila oil field' },
  // Yemen — Marib oil fields, Aden refinery
  { lat: 15.47, lon: 45.32, r: 0.3, label: 'Marib oil fields' },
  { lat: 12.80, lon: 45.03, r: 0.2, label: 'Aden refinery' },
  // Syria — oil fields
  { lat: 35.33, lon: 40.14, r: 0.3, label: 'Deir ez-Zor oil fields' },
  // Egypt — Sinai industrial
  { lat: 29.97, lon: 32.55, r: 0.2, label: 'Suez refinery' },
  // Saudi Arabia (near border)
  { lat: 26.30, lon: 50.10, r: 0.4, label: 'Dammam/Dhahran oil' },
  { lat: 25.38, lon: 49.48, r: 0.3, label: 'Abqaiq processing' },
  // Kuwait oil fields
  { lat: 29.08, lon: 47.68, r: 0.3, label: 'Kuwait oil fields' },
  // Turkey — southeastern industrial
  { lat: 37.76, lon: 40.74, r: 0.2, label: 'Batman refinery' },
];

interface FIRMSHotspot {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: string | number;
  frp: number;
  daynight: string;
}

// Check if a hotspot falls within a known industrial zone
function isInIndustrialZone(lat: number, lon: number): string | null {
  for (const zone of KNOWN_INDUSTRIAL_ZONES) {
    const dLat = Math.abs(lat - zone.lat);
    const dLon = Math.abs(lon - zone.lon);
    if (dLat <= zone.r && dLon <= zone.r) {
      return zone.label;
    }
  }
  return null;
}

// Determine if a hotspot is likely military/conflict vs routine
function isMilitaryGrade(h: FIRMSHotspot): { pass: boolean; reason: string } {
  const industrialZone = isInIndustrialZone(h.latitude, h.longitude);

  // If in known industrial zone, only pass if EXTREMELY high (possible strike ON facility)
  if (industrialZone) {
    if (h.frp > 200 && h.brightness > 420) {
      return { pass: true, reason: `extreme_at_facility:${industrialZone}` };
    }
    return { pass: false, reason: `industrial:${industrialZone}` };
  }

  // Daytime low-medium FRP = likely agricultural burning
  if (h.daynight === 'D' && h.frp < 40 && h.brightness < 350) {
    return { pass: false, reason: 'agricultural_daytime' };
  }

  // Low confidence = sensor noise or cloud artifact
  if (h.confidence === 'low' || h.confidence === 'l') {
    return { pass: false, reason: 'low_confidence' };
  }

  // Military-grade thresholds:
  // - Extreme: FRP > 100 or brightness > 400 → almost certainly explosion/launch
  if (h.frp > 100 || h.brightness > 400) {
    return { pass: true, reason: 'extreme_signature' };
  }

  // - High: FRP > 50 at night with good confidence → suspicious
  if (h.frp > 50 && h.daynight === 'N') {
    return { pass: true, reason: 'high_frp_night' };
  }

  // - High FRP daytime but NOT in agricultural pattern
  if (h.frp > 70) {
    return { pass: true, reason: 'high_frp_general' };
  }

  // Everything else is filtered out
  return { pass: false, reason: 'below_threshold' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Fetching NASA FIRMS — military-grade filter active...');

    const results = await Promise.allSettled(
      FIRMS_SOURCES.map(async (source) => {
        const resp = await fetch(source.url, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) throw new Error(`${source.name}: ${resp.status}`);
        const csv = await resp.text();
        const hotspots = parseCSV(csv, source.satellite);
        return { source: source.name, satellite: source.satellite, hotspots };
      })
    );

    const allHotspots: FIRMSHotspot[] = [];
    const sourceStats: Record<string, { total: number; middleEast: number; filtered: number; status: string }> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { source, hotspots } = result.value;
        const meHotspots = hotspots.filter(h =>
          h.latitude >= BBOX.south && h.latitude <= BBOX.north &&
          h.longitude >= BBOX.west && h.longitude <= BBOX.east
        );
        allHotspots.push(...meHotspots);
        sourceStats[source] = { total: hotspots.length, middleEast: meHotspots.length, filtered: 0, status: 'ok' };
        console.log(`${source}: ${hotspots.length} global, ${meHotspots.length} Middle East`);
      } else {
        const sourceName = FIRMS_SOURCES[results.indexOf(result)]?.name || 'unknown';
        sourceStats[sourceName] = { total: 0, middleEast: 0, filtered: 0, status: `error: ${result.reason}` };
        console.warn(`Failed to fetch ${sourceName}:`, result.reason);
      }
    }

    const deduped = deduplicateHotspots(allHotspots);

    // ── MILITARY-GRADE FILTER — remove routine industrial/agricultural signatures ──
    let filteredOut = 0;
    const militaryOnly = deduped.filter(h => {
      const result = isMilitaryGrade(h);
      if (!result.pass) {
        filteredOut++;
      }
      return result.pass;
    });

    console.log(`FIRMS filter: ${deduped.length} total → ${militaryOnly.length} military-grade (${filteredOut} filtered: industrial/agricultural/noise)`);

    // Sort by most recent
    militaryOnly.sort((a, b) => {
      const timeA = `${a.acq_date} ${a.acq_time}`;
      const timeB = `${b.acq_date} ${b.acq_time}`;
      return timeB.localeCompare(timeA);
    });

    // Classify
    const classified = militaryOnly.map(h => ({
      ...h,
      region: classifyRegion(h.latitude, h.longitude),
      intensity: classifyIntensity(h.brightness, h.frp),
      filterReason: isMilitaryGrade(h).reason,
    }));

    let latestAcqTime = 'N/A';
    if (classified.length > 0) {
      latestAcqTime = `${classified[0].acq_date} ${classified[0].acq_time}`;
    }

    // Store only truly significant hotspots (extreme/high that passed military filter)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const significant = classified.filter(h => h.intensity === 'high' || h.intensity === 'extreme');

    if (significant.length > 0) {
      const byRegion: Record<string, typeof significant> = {};
      for (const h of significant) {
        byRegion[h.region] = byRegion[h.region] || [];
        byRegion[h.region].push(h);
      }

      for (const [region, hotspots] of Object.entries(byRegion)) {
        const top = hotspots.sort((a, b) => b.brightness - a.brightness)[0];
        await supabase.from('intel_reports').insert({
          title: `🛰️ FIRMS: ${top.intensity === 'extreme' ? '🔴' : '🟠'} סיכון תרמי ${region} — חשד צבאי`,
          summary: `${hotspots.length} נקודות חום בדרגה צבאית ב${region} | FRP=${top.frp}MW, ${top.brightness}K | לווין: ${top.satellite} | סינון: ${filteredOut} תעשייתיים/חקלאיים הוסרו`,
          category: 'satellite',
          source: 'nasa_firms',
          severity: top.intensity === 'extreme' ? 'critical' : 'high',
          region,
          tags: ['satellite', 'thermal', 'firms', 'military_grade', top.satellite],
          raw_data: {
            count: hotspots.length,
            top_hotspot: top,
            latest_acq: `${top.acq_date} ${top.acq_time}`,
            all_satellites: [...new Set(hotspots.map(h => h.satellite))],
            filtered_out: filteredOut,
            filter_active: true,
          },
        });
      }
    }

    console.log(`FIRMS final: ${classified.length} military-grade hotspots, ${significant.length} significant, latest: ${latestAcqTime}`);

    return new Response(JSON.stringify({
      ok: true,
      sources: sourceStats,
      latestAcquisition: latestAcqTime,
      hotspots: classified,
      count: classified.length,
      significant: significant.length,
      filteredOut,
      filterActive: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('FIRMS error:', error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function deduplicateHotspots(hotspots: FIRMSHotspot[]): FIRMSHotspot[] {
  const grid = new Map<string, FIRMSHotspot>();
  for (const h of hotspots) {
    const key = `${Math.round(h.latitude * 100)}_${Math.round(h.longitude * 100)}`;
    const existing = grid.get(key);
    if (!existing || h.brightness > existing.brightness) {
      grid.set(key, h);
    }
  }
  return Array.from(grid.values());
}

function parseCSV(csv: string, defaultSatellite: string): FIRMSHotspot[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const results: FIRMSHotspot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < headers.length) continue;
    const obj: any = {};
    headers.forEach((h, idx) => { obj[h] = values[idx]?.trim(); });
    const lat = parseFloat(obj.latitude);
    const lon = parseFloat(obj.longitude);
    if (isNaN(lat) || isNaN(lon)) continue;
    results.push({
      latitude: lat,
      longitude: lon,
      brightness: parseFloat(obj.bright_ti4 || obj.brightness || '0'),
      scan: parseFloat(obj.scan || '0'),
      track: parseFloat(obj.track || '0'),
      acq_date: obj.acq_date || '',
      acq_time: obj.acq_time || '',
      satellite: obj.satellite || defaultSatellite,
      confidence: obj.confidence || 'nominal',
      frp: parseFloat(obj.frp || '0'),
      daynight: obj.daynight || 'D',
    });
  }
  return results;
}

function classifyRegion(lat: number, lon: number): string {
  if (lat >= 29 && lat <= 33.5 && lon >= 34 && lon <= 36) return 'ישראל';
  if (lat >= 33 && lat <= 35 && lon >= 35 && lon <= 37) return 'לבנון';
  if (lat >= 32 && lat <= 37 && lon >= 35.5 && lon <= 42) return 'סוריה';
  if (lat >= 25 && lat <= 38 && lon >= 44 && lon <= 63) return 'איראן';
  if (lat >= 12 && lat <= 19 && lon >= 42 && lon <= 55) return 'תימן';
  if (lat >= 29 && lat <= 37 && lon >= 38 && lon <= 49) return 'עיראק';
  if (lat >= 27 && lat <= 32 && lon >= 32 && lon <= 35) return 'סיני';
  return 'מזרח תיכון';
}

function classifyIntensity(brightness: number, frp: number): string {
  if (frp > 100 || brightness > 400) return 'extreme';
  if (frp > 50 || brightness > 350) return 'high';
  if (frp > 20 || brightness > 320) return 'medium';
  return 'low';
}
