import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

// ── X/Twitter accounts to monitor — Israeli/MENA OSINT & security sources ──
const X_ACCOUNTS = [
  { handle: 'AmichaiStein1', label: 'Amichai Stein' },
  { handle: 'GLZRadio', label: 'גלצ' },
  { handle: 'kann_news', label: 'כאן חדשות' },
  { handle: 'IntelDoge', label: 'IntelDoge' },
  { handle: 'sentdefender', label: 'Sentinel' },
  { handle: 'ELINTNews', label: 'ELINT News' },
  { handle: 'IsraelRadar_com', label: 'Israel Radar' },
  { handle: 'AuroraIntel', label: 'Aurora Intel' },
  { handle: 'WarMonitor3', label: 'War Monitor' },
  { handle: 'Liveuamap', label: 'Liveuamap' },
  { handle: 'YWNReporter', label: 'YWN' },
  { handle: 'noaborovich1', label: 'N12' },
  { handle: 'iaborovich1', label: 'i24NEWS' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_POST_AGE_HOURS = 6;

const RELEVANCE_KEYWORDS_HE = [
  'טיל', 'רקטה', 'אזעקה', 'צבע אדום', 'פיקוד העורף', 'צה"ל', 'שב"כ', 'חיל האוויר',
  'חיזבאללה', 'חמאס', 'איראן', 'עזה', 'לבנון', 'סוריה', 'יירוט', 'שיגור', 'נפילה',
  'תקיפה', 'פגיעה', 'פיגוע', 'חדירה', 'כוננות', 'הסלמה', 'מבזק', 'חירום',
  'כטב"מ', 'מל"ט', 'חטופים', 'נפגעים', 'מד"א',
];

const RELEVANCE_KEYWORDS_EN = [
  'israel', 'iran', 'gaza', 'lebanon', 'syria', 'hezbollah', 'hamas', 'idf',
  'rocket', 'missile', 'drone', 'intercept', 'attack', 'strike', 'terror',
  'alert', 'escalation', 'breaking', 'sirens', 'incoming', 'launch', 'impact',
  'killed', 'wounded', 'casualties', 'operation', 'ceasefire', 'hostage',
  'iron dome', 'david sling', 'arrow', 'thaad', 'patriot',
  'houthi', 'yemen', 'red sea', 'proxy',
];

const SPAM_PATTERNS = [
  /casino/i, /binance/i, /crypto/i, /trading/i, /investment/i,
  /forex/i, /earn money/i, /subscribe/i, /follow me/i, /giveaway/i,
];

type ScrapedTweet = {
  handle: string;
  label: string;
  text: string;
  tweetUrl: string;
  postedAt: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function normalizeForDedup(text: string): string {
  return text
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\s\-_.,!?:;()\[\]{}#@'"0-9]/g, '')
    .slice(0, 60)
    .toLowerCase();
}

function isSpam(text: string): boolean {
  return SPAM_PATTERNS.some(p => p.test(text));
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANCE_KEYWORDS_HE.some(kw => text.includes(kw)) ||
         RELEVANCE_KEYWORDS_EN.some(kw => lower.includes(kw));
}

function extractSeverity(text: string): string {
  const lower = text.toLowerCase();
  if (/breaking|מבזק|דחוף|אזעקה|צבע אדום|פגיעה ישירה|יירוט|שיגור|נפילה|תקיפה|פיגוע|חיסול|attack|strike|rocket|missile|intercept|incoming|sirens/i.test(lower)) return 'critical';
  if (/כוננות|הסלמה|חדירה|כטב|מל"ט|drone|uav|warning|alert|operation/i.test(lower)) return 'high';
  if (/עדכון|דיווח|צה"ל|שב"כ|פיקוד העורף|update|report|idf/i.test(lower)) return 'medium';
  return 'low';
}

function classifyCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/פיגוע|טרור|חדירה|terror|attack/.test(lower)) return 'terrorism';
  if (/איראן|לבנון|סוריה|עזה|חיזבאללה|חמאס|צה"ל|יירוט|שיגור|תקיפה|missile|rocket|idf|hezbollah|hamas|drone|intercept/.test(lower)) return 'military';
  if (/הפסקת אש|קבינט|סנקציות|דיפלומט|ceasefire|sanctions|cabinet|diplomatic/.test(lower)) return 'diplomatic';
  return 'general';
}

function extractHeadline(text: string): string {
  const firstLine = text.split('\n').map(l => l.trim()).find(Boolean) || text;
  return firstLine.replace(/\s+/g, ' ').slice(0, 120);
}

// Method 1: X Syndication API (public, no auth needed)
async function fetchViaSyndication(handle: string, label: string): Promise<ScrapedTweet[]> {
  try {
    // X syndication timeline endpoint (used by embedded timelines)
    const resp = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`,
      {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html',
          'Referer': 'https://platform.twitter.com/',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) {
      console.warn(`x-feed-scrape syndication: ${handle} returned ${resp.status}`);
      return [];
    }
    
    const html = await resp.text();
    const tweets: ScrapedTweet[] = [];
    
    // Parse embedded timeline HTML
    const tweetBlocks = html.split('data-tweet-id="').slice(1);
    for (const block of tweetBlocks) {
      const idEnd = block.indexOf('"');
      const tweetId = block.slice(0, idEnd);
      
      const textMatch = block.match(/class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                         block.match(/class="[^"]*tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                         block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (!textMatch?.[1]) continue;
      
      const text = stripHtml(textMatch[1]);
      if (!text || text.length < 10) continue;
      
      const timeMatch = block.match(/datetime="([^"]+)"/i);
      
      tweets.push({
        handle,
        label,
        text,
        tweetUrl: `https://x.com/${handle}/status/${tweetId}`,
        postedAt: timeMatch?.[1] || null,
      });
    }
    
    if (tweets.length > 0) {
      console.log(`x-feed-scrape syndication: Got ${tweets.length} from ${handle}`);
    }
    return tweets;
  } catch (e) {
    console.warn(`x-feed-scrape syndication error for ${handle}:`, e);
    return [];
  }
}

// Method 2: RSSHub (self-hosted RSS aggregator mirrors)
async function fetchViaRss(handle: string, label: string): Promise<ScrapedTweet[]> {
  const rssUrls = [
    `https://rsshub.app/twitter/user/${handle}`,
    `https://rss.app/feeds/twitter/${handle}`,
  ];
  
  for (const url of rssUrls) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      
      const xml = await resp.text();
      const items = xml.split('<item>').slice(1);
      const tweets: ScrapedTweet[] = [];
      
      for (const item of items) {
        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
        const linkMatch = item.match(/<link>(https?:\/\/[^<]+)<\/link>/);
        const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
        
        const text = stripHtml(titleMatch?.[1] || descMatch?.[1] || '');
        if (!text || text.length < 10) continue;
        
        tweets.push({
          handle,
          label,
          text,
          tweetUrl: linkMatch?.[1] || `https://x.com/${handle}`,
          postedAt: dateMatch?.[1] || null,
        });
      }
      
      if (tweets.length > 0) {
        console.log(`x-feed-scrape RSS: Got ${tweets.length} from ${url}`);
        return tweets;
      }
    } catch {
      continue;
    }
  }
  return [];
}

// Method 3: Nitter instances
async function fetchViaNitter(handle: string, label: string): Promise<ScrapedTweet[]> {
  const instances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.woodland.cafe',
    'https://nitter.net',
  ];
  
  for (const nitter of instances) {
    try {
      const resp = await fetch(`${nitter}/${handle}`, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      
      const html = await resp.text();
      const tweets: ScrapedTweet[] = [];
      const items = html.split('class="timeline-item"').slice(1);
      
      for (const item of items) {
        const contentMatch = item.match(/class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (!contentMatch?.[1]) continue;
        
        const text = stripHtml(contentMatch[1]);
        if (!text || text.length < 10) continue;
        
        const linkMatch = item.match(/href="(\/[^"]+\/status\/\d+)"/i);
        const tweetPath = linkMatch?.[1] || '';
        const timeMatch = item.match(/datetime="([^"]+)"/i);
        
        tweets.push({
          handle,
          label,
          text,
          tweetUrl: `https://x.com${tweetPath}`,
          postedAt: timeMatch?.[1] || null,
        });
      }
      
      if (tweets.length > 0) {
        console.log(`x-feed-scrape nitter: Got ${tweets.length} from ${nitter}/${handle}`);
        return tweets;
      }
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchTweets(handle: string, label: string): Promise<ScrapedTweet[]> {
  // Try methods in order: syndication → RSS → Nitter
  let tweets = await fetchViaSyndication(handle, label);
  if (tweets.length > 0) return tweets;
  
  tweets = await fetchViaRss(handle, label);
  if (tweets.length > 0) return tweets;
  
  tweets = await fetchViaNitter(handle, label);
  if (tweets.length > 0) return tweets;
  
  console.warn(`x-feed-scrape: All methods failed for ${handle}`);
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedHandles = Array.isArray(body?.accounts) ? body.accounts : null;
    
    const accounts = requestedHandles
      ? X_ACCOUNTS.filter(a => requestedHandles.includes(a.handle))
      : X_ACCOUNTS;

    const maxAgeMs = MAX_POST_AGE_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const methodStats: Record<string, number> = {};

    // Fetch in parallel batches of 5
    const allTweets: ScrapedTweet[] = [];
    for (let i = 0; i < accounts.length; i += 5) {
      const batch = accounts.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(acc => fetchTweets(acc.handle, acc.label))
      );
      allTweets.push(...results.flat());
    }

    // Filter: age, spam, relevance
    const filtered = allTweets
      .filter(t => t.text.length >= 12)
      .filter(t => !isSpam(t.text))
      .filter(t => isRelevant(t.text))
      .filter(t => {
        if (!t.postedAt) return true;
        const ts = new Date(t.postedAt).getTime();
        return Number.isFinite(ts) ? now - ts <= maxAgeMs : true;
      });

    // Deduplicate within batch
    const deduped = filtered.filter((t, idx, arr) => {
      const norm = normalizeForDedup(t.text);
      return arr.findIndex(x => normalizeForDedup(x.text) === norm) === idx;
    });

    // Cross-reference with ALL existing intel_reports to avoid duplicates across sources
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('intel_reports')
      .select('title, summary')
      .gte('created_at', since)
      .limit(1000);

    const existingNorms = new Set(
      (existing || []).flatMap(r => [normalizeForDedup(r.title), normalizeForDedup(r.summary || '')])
    );

    let stored = 0;
    const byAccount: Record<string, number> = {};

    for (const tweet of deduped) {
      const headline = extractHeadline(tweet.text);
      const title = `[X·${tweet.label}] ${headline}`;
      const normTitle = normalizeForDedup(title);
      const normText = normalizeForDedup(tweet.text);
      
      byAccount[tweet.handle] = (byAccount[tweet.handle] || 0) + 1;

      // Cross-source dedup: skip if similar content exists from ANY source (telegram, news, etc.)
      if (existingNorms.has(normTitle) || existingNorms.has(normText)) continue;

      const { error } = await supabase.from('intel_reports').insert({
        source: `x_${tweet.handle}`,
        category: classifyCategory(tweet.text),
        title,
        summary: tweet.text.slice(0, 450),
        severity: extractSeverity(tweet.text),
        region: 'ישראל',
        tags: ['x', 'twitter', tweet.handle, classifyCategory(tweet.text)],
        raw_data: {
          account_handle: tweet.handle,
          account_label: tweet.label,
          tweet_url: tweet.tweetUrl,
          posted_at: tweet.postedAt,
          scraped_at: new Date().toISOString(),
        },
      });

      if (!error) {
        stored++;
        existingNorms.add(normTitle);
        existingNorms.add(normText);
      } else {
        console.error('x-feed-scrape insert error:', error.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      accounts_checked: accounts.length,
      scraped: allTweets.length,
      relevant: filtered.length,
      deduped: deduped.length,
      stored,
      by_account: byAccount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('x-feed-scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
