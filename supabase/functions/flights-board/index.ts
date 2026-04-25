// Flights Board — TLV/HFA/ETM live arrivals/departures inferred from OpenSky positions.
// No API key required. Uses bbox queries around each airport, classifies by altitude+heading.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';

interface AirportSpec {
  iata: string;
  name: string;
  nameHe: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

const AIRPORTS: AirportSpec[] = [
  { iata: 'TLV', name: 'Ben Gurion',  nameHe: 'נתב"ג',  lat: 32.0114, lon: 34.8867, radiusKm: 60 },
  { iata: 'HFA', name: 'Haifa',       nameHe: 'חיפה',   lat: 32.8094, lon: 35.0431, radiusKm: 35 },
  { iata: 'ETM', name: 'Ramon',       nameHe: 'רמון',   lat: 29.7236, lon: 35.0114, radiusKm: 50 },
];

function bbox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return { lamin: lat - dLat, lomin: lon - dLon, lamax: lat + dLat, lomax: lon + dLon };
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function fetchAirport(ap: AirportSpec) {
  const b = bbox(ap.lat, ap.lon, ap.radiusKm);
  const url = `${OPENSKY_URL}?lamin=${b.lamin}&lomin=${b.lomin}&lamax=${b.lamax}&lomax=${b.lomax}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { iata: ap.iata, error: `HTTP ${r.status}`, flights: [] };
    const data = await r.json();
    const states: any[] = data.states || [];
    const flights = states
      .filter((s) => s[5] != null && s[6] != null)
      .map((s) => {
        const lon = s[5], lat = s[6];
        const altFt = s[7] ? Math.round(s[7] * 3.28084) : 0;
        const ktVel = s[9] ? Math.round(s[9] * 1.944) : 0;
        const vert = s[11] || 0; // m/s
        const onGround = !!s[8];
        const distKm = distanceKm(lat, lon, ap.lat, ap.lon);

        // Classify
        let phase: 'departing' | 'arriving' | 'taxi' | 'approach' | 'enroute' = 'enroute';
        if (onGround) phase = 'taxi';
        else if (altFt < 6000 && vert > 1) phase = 'departing';
        else if (altFt < 6000 && vert < -1) phase = 'arriving';
        else if (altFt < 12000 && distKm < 25) phase = 'approach';

        return {
          icao24: s[0],
          callsign: (s[1] || '').trim() || s[0],
          country: s[2],
          lat, lon, altFt, ktVel,
          headingDeg: s[10],
          verticalRateMs: vert,
          onGround,
          distanceKm: Math.round(distKm),
          phase,
        };
      })
      .filter((f) => f.phase !== 'enroute' || f.distanceKm < ap.radiusKm * 0.7);

    return { iata: ap.iata, name: ap.name, nameHe: ap.nameHe, lat: ap.lat, lon: ap.lon, flights };
  } catch (e) {
    return { iata: ap.iata, error: String(e), flights: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const results = await Promise.all(AIRPORTS.map(fetchAirport));
    const totalFlights = results.reduce((sum, a: any) => sum + (a.flights?.length || 0), 0);
    return new Response(JSON.stringify({
      ok: true,
      time: Math.floor(Date.now() / 1000),
      airports: results,
      totalFlights,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), airports: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
