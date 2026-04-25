import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Working alert sources — ordered by reliability
// Note: oref.org.il endpoints are geo-restricted to Israeli IPs and will 403 from outside Israel
const ALERT_SOURCES = [
  {
    name: 'tzevaadom-live',
    url: 'https://api.tzevaadom.co.il/notifications',
    headers: { 'Accept': 'application/json' },
    parseAlerts: (data: any) => {
      if (Array.isArray(data)) return data;
      if (data?.notifications) return data.notifications;
      return [];
    },
    parseHistory: false,
  },
  {
    name: 'tzevaadom-history',
    url: 'https://api.tzevaadom.co.il/alerts-history',
    headers: { 'Accept': 'application/json' },
    parseAlerts: (data: any) => {
      if (!Array.isArray(data)) return [];
      // Each item has { id, alerts: [{ time, cities, threat }], description }
      const all: any[] = [];
      for (const group of data) {
        if (!group.alerts || !Array.isArray(group.alerts)) continue;
        for (const a of group.alerts) {
          all.push({
            ...a,
            groupId: group.id,
            description: group.description,
            cities: a.cities || [],
            alertDate: a.time,
            title: (a.cities || []).join(', ') || 'התרעה',
            cat: a.threat ?? 0,
          });
        }
      }
      return all;
    },
    parseHistory: true,
  },
];

interface NormalizedAlert {
  alert_date: string;
  title: string;
  category: number;
  description: string;
  locations: string[];
  raw_data: any;
}

function normalizeLocations(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function resolveAlertDate(a: any): string {
  const candidate = a.alertDate ?? a.date ?? a.timestamp ?? a.alert_date ?? a.time;

  if (typeof candidate === 'number') {
    const millis = candidate > 1e12 ? candidate : candidate * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof candidate === 'string' && candidate.trim()) {
    const numericCandidate = Number(candidate);
    if (!Number.isNaN(numericCandidate)) {
      const millis = numericCandidate > 1e12 ? numericCandidate : numericCandidate * 1000;
      return new Date(millis).toISOString();
    }
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function buildAlertKey(alert: Pick<NormalizedAlert, 'title' | 'locations' | 'alert_date' | 'raw_data'>): string {
  const raw = alert.raw_data || {};
  const notificationId = raw.notificationId || raw.id || '';
  const threat = raw.threat ?? 'na';
  const locationsKey = [...(alert.locations || [])].map(String).sort().join(',');

  return `${notificationId || alert.title}|${threat}|${locationsKey}`;
}

function normalizeAlert(a: any, _isHistory: boolean): NormalizedAlert {
  const locationCandidates = [a.data, a.cities, a.locations, a.city];
  const locations = locationCandidates
    .map(normalizeLocations)
    .find((items) => items.length > 0) || [];

  const alertDate = resolveAlertDate(a);

  const cat = typeof a.cat === 'number'
    ? a.cat
    : typeof a.category === 'number'
      ? a.category
      : 1;

  return {
    alert_date: alertDate,
    title: a.title || a.cities?.join(', ') || locations.join(', ') || 'התרעה',
    category: cat,
    description: a.desc || a.description || '',
    locations,
    raw_data: a,
  };
}

async function tryFetchAlerts(source: typeof ALERT_SOURCES[0]): Promise<{ alerts: NormalizedAlert[]; sourceName: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(source.url, {
      headers: source.headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`${source.name}: HTTP ${res.status}`);
      return { alerts: [], sourceName: source.name };
    }

    const text = await res.text();
    const cleanText = text.replace(/^\uFEFF/, '').trim();

    if (!cleanText || cleanText.startsWith('<') || cleanText.startsWith('<!')) {
      console.log(`${source.name}: got HTML or empty response`);
      return { alerts: [], sourceName: source.name };
    }

    const data = JSON.parse(cleanText);
    const rawAlerts = source.parseAlerts(data);
    const normalized = rawAlerts.map((a: any) => normalizeAlert(a, source.parseHistory));

    console.log(`${source.name}: fetched ${normalized.length} alerts`);
    return { alerts: normalized, sourceName: source.name };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log(`${source.name} failed:`, errorMessage);
    return { alerts: [], sourceName: source.name };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const results = await Promise.all(ALERT_SOURCES.map(tryFetchAlerts));

    const seen = new Set<string>();
    const allAlerts: NormalizedAlert[] = [];
    const successfulSources: string[] = [];

    for (const { alerts, sourceName } of results) {
      if (alerts.length > 0) successfulSources.push(sourceName);
      for (const alert of alerts) {
        const key = buildAlertKey(alert);
        if (!seen.has(key)) {
          seen.add(key);
          allAlerts.push(alert);
        }
      }
    }

    allAlerts.sort((a, b) => new Date(b.alert_date).getTime() - new Date(a.alert_date).getTime());

    // Try to store in DB with a tight timeout — don't block response
    let stored = 0;
    let dbAlerts: any[] | null = null;

    const dbTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);

    try {
      const existResult = await dbTimeout(supabase
        .from('oref_alerts')
        .select('title, locations, alert_date, raw_data, created_at')
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000), 3000);

      if (existResult && (existResult as any).data) {
        const existingKeys = new Set(((existResult as any).data || []).map(buildAlertKey));
        const rowsToInsert = allAlerts.slice(0, 500).filter((alert) => !existingKeys.has(buildAlertKey(alert)));

        if (rowsToInsert.length > 0) {
          const insertResult = await dbTimeout(supabase.from('oref_alerts').insert(rowsToInsert), 3000);
          if (insertResult && !(insertResult as any).error) {
            stored = rowsToInsert.length;
          }
        }

        const latestResult = await dbTimeout(supabase
          .from('oref_alerts')
          .select('*')
          .order('alert_date', { ascending: false })
          .limit(200), 3000);
        if (latestResult && (latestResult as any).data) {
          dbAlerts = (latestResult as any).data;
        }
      }
    } catch (dbErr) {
      console.log('DB unavailable, using API data');
    }

    // Return DB alerts if available, otherwise return raw API alerts
    const responseAlerts = dbAlerts || allAlerts.slice(0, 200).map((a, i) => ({
      id: `api-${i}`,
      ...a,
      created_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
      ok: true,
      live: allAlerts.length > 0,
      fetched: allAlerts.length,
      stored,
      successfulSources,
      sourcesChecked: ALERT_SOURCES.map(s => s.name),
      alerts: responseAlerts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      ok: false,
      live: false,
      error: String(error),
      alerts: [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
