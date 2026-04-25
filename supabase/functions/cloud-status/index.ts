// ═══════════════════════════════════════════════════════════════
// cloud-status — Aggregates real uptime / incident status from
// AWS, Azure, GCP public status feeds. Returns provider health
// + simple load classification used to drive the data-flow color.
// ═══════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LoadStatus = 'normal' | 'congested' | 'fault';

interface ProviderStatus {
  provider: 'AWS' | 'Azure' | 'GCP';
  status: LoadStatus;
  incidentCount: number;
  lastUpdated: string;
  headlines: string[];
  source: string;
  ok: boolean;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'WarRoom/1.0 (+lovable.app)',
        Accept: 'application/rss+xml,application/json,text/xml,*/*',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return await r.text();
  } catch (_) {
    return null;
  }
}

function parseRssItems(xml: string): { title: string; pubDate?: string }[] {
  const items: { title: string; pubDate?: string }[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const titleRegex = /<title>([\s\S]*?)<\/title>/;
  const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
  const matches = xml.match(itemRegex) || [];
  for (const m of matches.slice(0, 25)) {
    const t = titleRegex.exec(m)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const d = dateRegex.exec(m)?.[1]?.trim();
    if (t) items.push({ title: t, pubDate: d });
  }
  return items;
}

function classify(headlines: string[]): LoadStatus {
  if (headlines.length === 0) return 'normal';
  const j = headlines.join(' ').toLowerCase();
  if (/(major|outage|down|unavailable|critical|widespread|sev[\s-]?1)/.test(j)) return 'fault';
  if (/(degrad|elevated|increased\s+latency|delay|partial|investigating|disruption)/.test(j)) return 'congested';
  return 'normal';
}

function recentOnly(items: { title: string; pubDate?: string }[], hours = 24) {
  const cutoff = Date.now() - hours * 3600_000;
  return items.filter(i => {
    if (!i.pubDate) return true;
    const t = Date.parse(i.pubDate);
    return Number.isFinite(t) ? t >= cutoff : true;
  });
}

async function getAws(): Promise<ProviderStatus> {
  const xml = await fetchText('https://status.aws.amazon.com/rss/all.rss');
  const items = xml ? recentOnly(parseRssItems(xml)) : [];
  const headlines = items.map(i => i.title).slice(0, 5);
  return {
    provider: 'AWS',
    status: classify(headlines),
    incidentCount: items.length,
    lastUpdated: new Date().toISOString(),
    headlines,
    source: 'status.aws.amazon.com',
    ok: xml !== null,
  };
}

async function getAzure(): Promise<ProviderStatus> {
  const xml = await fetchText('https://azurestatuscdn.azureedge.net/en-us/status/feed/');
  const items = xml ? recentOnly(parseRssItems(xml)) : [];
  const headlines = items.map(i => i.title).slice(0, 5);
  return {
    provider: 'Azure',
    status: classify(headlines),
    incidentCount: items.length,
    lastUpdated: new Date().toISOString(),
    headlines,
    source: 'status.azure.com',
    ok: xml !== null,
  };
}

async function getGcp(): Promise<ProviderStatus> {
  try {
    const r = await fetch('https://status.cloud.google.com/incidents.json', {
      headers: { Accept: 'application/json', 'User-Agent': 'WarRoom/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const cutoff = Date.now() - 24 * 3600_000;
    const recent = (Array.isArray(data) ? data : [])
      .filter((i: any) => {
        const end = i.end ? Date.parse(i.end) : null;
        const begin = i.begin ? Date.parse(i.begin) : null;
        if (!end) return true;
        return end >= cutoff || (begin && begin >= cutoff);
      })
      .slice(0, 25);
    const headlines = recent
      .map((i: any) => `${(i.severity || 'info').toUpperCase()}: ${i.external_desc || i.service_name || 'incident'}`)
      .slice(0, 5);
    let status: LoadStatus = 'normal';
    if (recent.some((i: any) => i.severity === 'high' && !i.end)) status = 'fault';
    else if (recent.some((i: any) => !i.end)) status = 'congested';
    return {
      provider: 'GCP',
      status,
      incidentCount: recent.length,
      lastUpdated: new Date().toISOString(),
      headlines,
      source: 'status.cloud.google.com',
      ok: true,
    };
  } catch (_) {
    return {
      provider: 'GCP',
      status: 'normal',
      incidentCount: 0,
      lastUpdated: new Date().toISOString(),
      headlines: [],
      source: 'status.cloud.google.com',
      ok: false,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const [aws, azure, gcp] = await Promise.all([getAws(), getAzure(), getGcp()]);
    const providers = [aws, azure, gcp];
    const overall: LoadStatus =
      providers.some(p => p.status === 'fault') ? 'fault' :
      providers.some(p => p.status === 'congested') ? 'congested' : 'normal';
    return new Response(JSON.stringify({ overall, providers, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('cloud-status error', e);
    return new Response(JSON.stringify({ overall: 'normal', providers: [], error: e instanceof Error ? e.message : 'unknown' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
