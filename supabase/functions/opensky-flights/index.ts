const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';

// Israel + surrounding region bounding box
const LAMIN = 29.0;
const LAMAX = 34.0;
const LOMIN = 33.5;
const LOMAX = 36.5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Allow caller to override bounding box via query string
    const reqUrl = new URL(req.url);
    const lamin = parseFloat(reqUrl.searchParams.get('lamin') || String(LAMIN));
    const lomin = parseFloat(reqUrl.searchParams.get('lomin') || String(LOMIN));
    const lamax = parseFloat(reqUrl.searchParams.get('lamax') || String(LAMAX));
    const lomax = parseFloat(reqUrl.searchParams.get('lomax') || String(LOMAX));
    const url = `${OPENSKY_URL}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    
    // Shorter timeout — OpenSky often hangs; better to fail fast and return empty
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'WarRoom/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenSky API error [${response.status}]: ${errText}`);
      return new Response(JSON.stringify({ 
        error: `OpenSky API returned ${response.status}`,
        states: [] 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    
    // Transform states into simplified aircraft objects
    // OpenSky state vector indices:
    // 0: icao24, 1: callsign, 2: origin_country, 3: time_position
    // 4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude
    // 8: on_ground, 9: velocity, 10: true_track, 11: vertical_rate
    // 12: sensors, 13: geo_altitude, 14: squawk, 15: spi, 16: position_source
    const aircraft = (data.states || [])
      .filter((s: any[]) => s[5] != null && s[6] != null && !s[8]) // has position, not on ground
      .map((s: any[]) => ({
        icao24: s[0],
        callsign: (s[1] || '').trim(),
        country: s[2],
        lon: s[5],
        lat: s[6],
        altitude: s[7] ? Math.round(s[7] * 3.28084) : null, // meters to feet
        onGround: s[8],
        velocity: s[9] ? Math.round(s[9] * 1.944) : null, // m/s to knots
        heading: s[10],
        verticalRate: s[11],
        squawk: s[14],
      }));

    return new Response(JSON.stringify({ 
      time: data.time,
      count: aircraft.length,
      aircraft 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OpenSky fetch error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      states: [] 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
