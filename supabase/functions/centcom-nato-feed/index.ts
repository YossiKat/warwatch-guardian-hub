import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

// ── CENTCOM RSS feeds ──
const CENTCOM_RSS = [
  'https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=808&isdashboardselected=0&max=20',
  'https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=8&Site=808&isdashboardselected=0&max=20',
];

// ── NATO news page (HTML scraping) ──
const NATO_URLS = [
  'https://www.nato.int/cps/en/natohq/news.htm',
  'https://www.nato.int/cps/en/natohq/official_texts.htm',
];

// Keywords relevant to Israel / Middle East
const RELEVANCE_KEYWORDS = [
  'israel', 'iran', 'hezbollah', 'hamas', 'gaza', 'lebanon', 'syria',
  'houthi', 'yemen', 'centcom', 'middle east', 'red sea', 'iraq',
  'missile', 'strike', 'defense', 'defence', 'nuclear', 'irgc',
  'mediterranean', 'drone', 'uav', 'intercept', 'deterrence',
  'escalation', 'ceasefire', 'hostage', 'military', 'combat',
  'operation', 'deployment', 'naval', 'air defense', 'ballistic',
  'cruise missile', 'terror', 'airspace', 'patrol', 'exercise',
  'readiness', 'threat', 'security', 'war', 'conflict',
];

function extractSeverity(text: string): string {
  const lower = text.toLowerCase();
  if (/strike|attack|combat|intercept|missile|killed|casualt|rescue|war\b/i.test(lower)) return 'critical';
  if (/deploy|escalat|threat|warning|alert|nuclear|ballistic/i.test(lower)) return 'high';
  if (/exercise|readiness|patrol|surveillance|drill/i.test(lower)) return 'warning';
  if (/visit|meeting|summit|agreement|cooperation/i.test(lower)) return 'medium';
  return 'low';
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => lower.includes(kw));
}

// Parse CENTCOM RSS (raw XML text)
function parseCentcomRss(xml: string): { title: string; url: string; summary: string; date: string }[] {
  const results: { title: string; url: string; summary: string; date: string }[] = [];

  // Split by item boundaries — RSS items are separated by title+link pairs
  const titlePattern = /<title>([^<]+)<\/title>/gi;
  const linkPattern = /<link>([^<]+)<\/link>/gi;
  const descPattern = /<description>([\s\S]*?)<\/description>/gi;
  const datePattern = /<pubDate>([^<]+)<\/pubDate>/gi;

  // Collect all matches
  const titles: string[] = [];
  const links: string[] = [];
  const descs: string[] = [];
  const dates: string[] = [];

  let m;
  while ((m = titlePattern.exec(xml)) !== null) titles.push(m[1].trim());
  while ((m = linkPattern.exec(xml)) !== null) links.push(m[1].trim());
  while ((m = descPattern.exec(xml)) !== null) descs.push(m[1].replace(/<[^>]+>/g, '').trim().slice(0, 300));
  while ((m = datePattern.exec(xml)) !== null) dates.push(m[1].trim());

  // Skip first title/link (channel level)
  for (let i = 1; i < titles.length; i++) {
    results.push({
      title: titles[i],
      url: links[i] || '',
      summary: descs[i - 1] || '',
      date: dates[i - 1] || '',
    });
  }

  return results;
}

// Parse CENTCOM HTML (fallback)
function parseCentcomHtml(html: string): { title: string; url: string; summary: string; date: string }[] {
  const results: { title: string; url: string; summary: string; date: string }[] = [];
  const pattern = /<a\s+href="(https:\/\/www\.centcom\.mil\/MEDIA\/[^"]+)"[^>]*><strong>([^<]+)<\/strong><\/a>\s*<br\s*\/?>\s*(\w+\s+\d{1,2},\s*\d{4})/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    results.push({
      title: m[2].trim(),
      url: m[1].trim(),
      summary: '',
      date: m[3].trim(),
    });
  }
  return results;
}

// Parse NATO HTML for news links
function parseNatoHtml(html: string): { title: string; url: string; summary: string; date: string }[] {
  const results: { title: string; url: string; summary: string; date: string }[] = [];

  // NATO news items in search results or listing
  // Pattern 1: article card links
  const pattern1 = /href="(\/cps\/en\/natohq\/(?:news|official_texts)_\d+\.htm)"[^>]*>\s*([^<]{10,})/gi;
  let m;
  while ((m = pattern1.exec(html)) !== null) {
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (title.length > 10 && !/cookie|privacy|login|register/i.test(title)) {
      results.push({
        title,
        url: `https://www.nato.int${m[1]}`,
        summary: '',
        date: '',
      });
    }
  }

  // Pattern 2: generic anchor with strong
  if (results.length === 0) {
    const pattern2 = /href="(https?:\/\/www\.nato\.int\/[^"]*)"[^>]*><[^>]*>([^<]{15,})<\//gi;
    while ((m = pattern2.exec(html)) !== null) {
      const title = m[2].replace(/\s+/g, ' ').trim();
      if (title.length > 15 && !/cookie|privacy|login|account|password/i.test(title)) {
        results.push({ title, url: m[1], summary: '', date: '' });
      }
    }
  }

  return results;
}

const UA = 'Mozilla/5.0 (compatible; WarWatch/1.0; +https://warwatch-guardian-hub.lovable.app)';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const allItems: any[] = [];

    // ── 1. CENTCOM via RSS ──
    for (const rssUrl of CENTCOM_RSS) {
      try {
        console.log(`Fetching CENTCOM RSS: ${rssUrl}`);
        const resp = await fetch(rssUrl, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml' } });
        if (!resp.ok) { console.warn(`CENTCOM RSS ${resp.status}`); continue; }
        const xml = await resp.text();
        const items = parseCentcomRss(xml);
        console.log(`CENTCOM RSS: ${items.length} items parsed`);

        for (const item of items) {
          const fullText = `${item.title} ${item.summary}`;
          if (isRelevant(fullText)) {
            allItems.push({
              source: 'centcom',
              category: 'military',
              title: `[CENTCOM] ${item.title}`,
              summary: item.summary || item.title,
              severity: extractSeverity(fullText),
              region: 'Middle East',
              tags: ['centcom', 'military', 'osint', 'external'],
              raw_data: { url: item.url, date: item.date, source_name: 'CENTCOM' },
            });
          }
        }
      } catch (err) {
        console.error('CENTCOM RSS error:', err);
      }
    }

    // ── 1b. CENTCOM HTML fallback ──
    if (allItems.filter(i => i.source === 'centcom').length === 0) {
      try {
        console.log('CENTCOM RSS empty, trying HTML fallback');
        const resp = await fetch('https://www.centcom.mil/MEDIA/PRESS-RELEASES/', { headers: { 'User-Agent': UA } });
        if (resp.ok) {
          const html = await resp.text();
          const items = parseCentcomHtml(html);
          console.log(`CENTCOM HTML: ${items.length} items`);
          for (const item of items) {
            if (isRelevant(item.title)) {
              allItems.push({
                source: 'centcom',
                category: 'military',
                title: `[CENTCOM] ${item.title}`,
                summary: `${item.date}\n${item.url}`,
                severity: extractSeverity(item.title),
                region: 'Middle East',
                tags: ['centcom', 'military', 'osint', 'external'],
                raw_data: { url: item.url, date: item.date, source_name: 'CENTCOM' },
              });
            }
          }
        }
      } catch (err) {
        console.error('CENTCOM HTML fallback error:', err);
      }
    }

    // ── 2. NATO via HTML ──
    for (const url of NATO_URLS) {
      try {
        console.log(`Fetching NATO: ${url}`);
        const resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
        if (!resp.ok) { console.warn(`NATO ${resp.status} for ${url}`); continue; }
        const html = await resp.text();
        const items = parseNatoHtml(html);
        console.log(`NATO: ${items.length} items from ${url}`);

        for (const item of items) {
          if (isRelevant(item.title)) {
            allItems.push({
              source: 'nato',
              category: 'geopolitical',
              title: `[NATO] ${item.title}`,
              summary: item.summary || item.title,
              severity: extractSeverity(item.title),
              region: 'Europe / Global',
              tags: ['nato', 'geopolitical', 'osint', 'external'],
              raw_data: { url: item.url, date: item.date, source_name: 'NATO' },
            });
          }
        }
      } catch (err) {
        console.error('NATO error:', err);
      }
    }

    console.log(`Total relevant items: ${allItems.length} (CENTCOM: ${allItems.filter(i => i.source === 'centcom').length}, NATO: ${allItems.filter(i => i.source === 'nato').length})`);

    // ── 3. Dedup against DB ──
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from('intel_reports')
      .select('title')
      .gte('created_at', since)
      .in('source', ['centcom', 'nato', 'cross_correlation'])
      .limit(500);

    const existingTitles = new Set((existing || []).map(r => r.title));

    let stored = 0;
    for (const item of allItems) {
      if (existingTitles.has(item.title)) continue;
      const { error } = await supabase.from('intel_reports').insert(item);
      if (!error) stored++;
      else console.error('Insert error:', error.message);
    }

    // ── 4. Cross-source comparison ──
    const centcomItems = allItems.filter(i => i.source === 'centcom');
    const natoItems = allItems.filter(i => i.source === 'nato');
    const comparisons: string[] = [];

    for (const c of centcomItems) {
      for (const n of natoItems) {
        const cWords = new Set(c.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4));
        const nWords = new Set(n.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4));
        const overlap = [...cWords].filter(w => nWords.has(w));
        if (overlap.length >= 2) {
          comparisons.push(`🔗 ${overlap.join(', ')}: CENTCOM → ${c.title} | NATO → ${n.title}`);
        }
      }
    }

    if (comparisons.length > 0) {
      const compTitle = `השוואת CENTCOM/NATO: ${comparisons.length} נושאים משותפים`;
      if (!existingTitles.has(compTitle)) {
        await supabase.from('intel_reports').insert({
          source: 'cross_correlation',
          category: 'geopolitical',
          title: compTitle,
          summary: comparisons.slice(0, 10).join('\n'),
          severity: 'high',
          region: 'Global',
          tags: ['centcom', 'nato', 'comparison', 'cross-source'],
          raw_data: { comparisons, centcom_count: centcomItems.length, nato_count: natoItems.length },
        });
      }
    }

    // ── 5. Return latest ──
    const { data: latestCentcom } = await supabase.from('intel_reports').select('*').eq('source', 'centcom').order('created_at', { ascending: false }).limit(20);
    const { data: latestNato } = await supabase.from('intel_reports').select('*').eq('source', 'nato').order('created_at', { ascending: false }).limit(20);
    const { data: latestComparisons } = await supabase.from('intel_reports').select('*').eq('source', 'cross_correlation').order('created_at', { ascending: false }).limit(5);

    return new Response(JSON.stringify({
      ok: true,
      scraped: allItems.length,
      stored,
      comparisons: comparisons.length,
      centcom: latestCentcom || [],
      nato: latestNato || [],
      cross: latestComparisons || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('CENTCOM/NATO feed error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
