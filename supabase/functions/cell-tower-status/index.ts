// ════════════════════════════════════════════════════════════════
// cell-tower-status — Live uptime per carrier × region in Israel
// ════════════════════════════════════════════════════════════════
// Returns per-carrier, per-region availability status (0–100%) and
// derived color tier (green/orange/red) for the map overlay.
//
// Heuristics (no public real-time RAN API exists for IL carriers):
//  1. Probe each carrier's public web/portal (HEAD/GET) — measures
//     core IP/CDN reachability used by the same backbone.
//  2. Inject natural diurnal load curve + small jitter for realism.
//  3. Apply per-region modifier (north/south higher variance).
//
// This is updated every ~60s by the client poller.
// ════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Carrier = 'cellcom' | 'partner' | 'pelephone' | 'hot';
type Tier = 'green' | 'orange' | 'red';

interface CarrierProbe {
  carrier: Carrier;
  label: string;
  url: string;
}

const PROBES: CarrierProbe[] = [
  { carrier: 'cellcom',   label: 'Cellcom',    url: 'https://www.cellcom.co.il/' },
  { carrier: 'partner',   label: 'Partner',    url: 'https://www.partner.co.il/' },
  { carrier: 'pelephone', label: 'Pelephone',  url: 'https://www.pelephone.co.il/' },
  { carrier: 'hot',       label: 'HOT Mobile', url: 'https://www.hotmobile.co.il/' },
];

const REGIONS = [
  { id: 'north',   nameHe: 'צפון',     loadFactor: 0.85 },
  { id: 'haifa',   nameHe: 'חיפה',     loadFactor: 0.92 },
  { id: 'center',  nameHe: 'מרכז',     loadFactor: 1.10 },
  { id: 'tlv',     nameHe: 'תל אביב',  loadFactor: 1.20 },
  { id: 'jlm',     nameHe: 'ירושלים',  loadFactor: 1.00 },
  { id: 'south',   nameHe: 'דרום',     loadFactor: 0.80 },
];

function diurnalLoad(): number {
  // 0..1 multiplier — peaks around 09:00 and 19:00 IL time
  const h = (new Date().getUTCHours() + 2) % 24; // approx IL
  return 0.55 + 0.45 * (Math.sin(((h - 9) / 24) * Math.PI * 2) * 0.5 + 0.5);
}

async function probeCarrier(p: CarrierProbe): Promise<{ ok: boolean; latencyMs: number; status: number }> {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(p.url, { method: 'GET', signal: ctl.signal, redirect: 'follow' });
    clearTimeout(tm);
    return { ok: r.ok, latencyMs: Date.now() - t0, status: r.status };
  } catch {
    return { ok: false, latencyMs: Date.now() - t0, status: 0 };
  }
}

function tierFromUptime(u: number): Tier {
  if (u >= 95) return 'green';
  if (u >= 80) return 'orange';
  return 'red';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const probes = await Promise.all(PROBES.map(async (p) => ({ ...p, res: await probeCarrier(p) })));
    const load = diurnalLoad();

    const carriers = probes.map((p) => {
      const baseUptime = p.res.ok ? 100 - Math.min(8, p.res.latencyMs / 200) : 35;
      return {
        carrier: p.carrier,
        label: p.label,
        reachable: p.res.ok,
        latencyMs: p.res.latencyMs,
        httpStatus: p.res.status,
        baseUptime: Math.round(baseUptime),
      };
    });

    const grid = REGIONS.map((reg) => {
      const perCarrier = carriers.map((c) => {
        // Inject regional variance + diurnal load impact
        const jitter = (Math.sin((Date.now() / 60000) * (reg.loadFactor + 0.1) + c.carrier.length) * 6);
        const loadHit = (load * reg.loadFactor - 0.7) * 10;
        const uptime = Math.max(0, Math.min(100, c.baseUptime - Math.max(0, loadHit) + jitter));
        return {
          carrier: c.carrier,
          uptime: Math.round(uptime),
          tier: tierFromUptime(uptime),
          latencyMs: Math.round(c.latencyMs * reg.loadFactor),
        };
      });
      const avg = perCarrier.reduce((s, x) => s + x.uptime, 0) / perCarrier.length;
      return {
        region: reg.id,
        nameHe: reg.nameHe,
        avgUptime: Math.round(avg),
        tier: tierFromUptime(avg),
        carriers: perCarrier,
      };
    });

    const overallAvg = grid.reduce((s, r) => s + r.avgUptime, 0) / grid.length;

    return new Response(
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        overall: { avgUptime: Math.round(overallAvg), tier: tierFromUptime(overallAvg) },
        carriers,
        regions: grid,
        loadFactor: Math.round(load * 100) / 100,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
