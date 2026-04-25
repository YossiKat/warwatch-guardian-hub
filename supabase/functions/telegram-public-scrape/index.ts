import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const DEFAULT_CHANNELS = [
  // ══════ Israeli News — חדשות ישראל ══════
  { handle: 'kann11news', label: 'כאן חדשות' },
  { handle: 'GLZRadio', label: 'גלצ רדיו' },
  { handle: 'NewsFlashIL', label: 'מבזקי חדשות IL' },
  { handle: 'Channel13News', label: 'ערוץ 13' },
  { handle: 'Channel12News', label: 'ערוץ 12' },
  { handle: 'N12News', label: 'N12' },
  { handle: 'yaborovich1', label: 'Borovich Updates' },
  { handle: 'maborovich1', label: 'Maborovich' },
  { handle: 'inaborovich1', label: 'Borovich Intel' },
  { handle: 'manaborovich1', label: 'Borovich Analysis' },
  { handle: 'WallaNews', label: 'וואלה חדשות' },
  { handle: 'yaborovich1', label: 'Borovich Updates' },
  { handle: 'IsraelHayomHeb', label: 'ישראל היום' },
  { handle: 'MaarivOnline', label: 'מעריב' },
  { handle: 'newsaborovich1', label: 'News A Borovich' },

  // ══════ Israeli Finance — כלכלה ישראל ══════
  { handle: 'globikilanot', label: 'גלובס' },
  { handle: 'TheMarkerCom', label: 'דה מרקר' },
  { handle: 'CalcalistNews', label: 'כלכליסט' },
  { handle: 'BizPortalIL', label: 'ביזפורטל' },

  // ══════ IDF / Emergency — צה"ל / חירום ══════
  { handle: 'idfonline', label: 'דובר צה"ל' },
  { handle: 'PikudHaoref_all', label: 'פיקוד העורף' },
  { handle: 'red_alert_israel', label: 'צבע אדום' },
  { handle: 'mdaborovich1', label: 'MDA Borovich' },
  { handle: 'IsraelPolice', label: 'משטרת ישראל' },

  // ══════ Global Intel — מודיעין גלובלי ══════
  { handle: 'Middle_East_Spectator', label: 'Middle East Spectator' },
  { handle: 'warmonitors', label: 'War Monitor' },
  { handle: 'CIG_telegram', label: 'CIG Intel' },
  { handle: 'sentdefender', label: 'Sentdefender' },
  { handle: 'ELINTNews', label: 'ELINT News' },
  { handle: 'AuroraIntel', label: 'Aurora Intel' },
  { handle: 'TheIntelLab', label: 'The Intel Lab' },
  { handle: 'RWApodcast', label: 'RWA Podcast' },
  { handle: 'OSINTdefender', label: 'OSINT Defender' },
  { handle: 'IntelCrab', label: 'Intel Crab' },
  { handle: 'JoelWing2', label: 'Joel Wing Iraq' },
  { handle: 'Fightingforthefaith', label: 'Fighting For Faith' },
  { handle: 'MilitaryLand', label: 'Military Land' },

  // ══════ Major Wires — סוכנויות חדשות ══════
  { handle: 'reuters', label: 'Reuters' },
  { handle: 'bbcnews', label: 'BBC News' },
  { handle: 'caborovich1', label: 'CA Borovich' },
  { handle: 'cnaborovich1', label: 'CN Borovich' },
  { handle: 'RTNews', label: 'RT News' },
  { handle: 'taborovich1', label: 'TA Borovich' },
  { handle: 'AlJazeeraChannel', label: 'Al Jazeera' },
  { handle: 'SkyNewsArabia_Breaking', label: 'Sky News Arabia' },

  // ══════ Russian / Pro-Russian Intel ══════
  { handle: 'intel_slava', label: 'Intel Slava Z' },
  { handle: 'rybar', label: 'Rybar' },
  { handle: 'russiandfront', label: 'Russian D Front' },

  // ══════ Iranian / Axis Sources ══════
  { handle: 'Iran_int', label: 'Iran International' },
  { handle: 'IranPressNews', label: 'Iran Press' },
  { handle: 'ABOROVICH2', label: 'A Borovich 2' },

  // ══════ Arab News ══════
  { handle: 'AlArabiya_Brk', label: 'العربية مبزק' },
  { handle: 'AlMayadeenNews', label: 'الميادين' },
  { handle: 'AJABreaking', label: 'الجزيرة عاجل' },

  // ══════ OSINT / Analytics ══════
  { handle: 'GeoConfirmed', label: 'GeoConfirmed' },
  { handle: 'Liveuamap', label: 'Liveuamap' },
  { handle: 'NuclearPlanet', label: 'Nuclear Planet' },
];

// Deduplicate by handle
const UNIQUE_CHANNELS = DEFAULT_CHANNELS.filter((ch, idx, arr) =>
  arr.findIndex(c => c.handle === ch.handle) === idx
);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_POST_AGE_HOURS = 6;

const RELEVANCE_KEYWORDS_HE = [
  'טיל', 'טילי', 'טילים', 'רקט', 'רקטה', 'רקטות', 'אזעק', 'צבע אדום', 'פיקוד העורף',
  'צה"ל', 'צהל', 'שב"כ', 'חיל האוויר', 'חיזבאללה', 'חמאס', 'איראן', 'עזה', 'לבנון',
  'סוריה', 'יירוט', 'שיגור', 'נפילה', 'נפילת', 'תקיפ', 'פגיע', 'פיגוע', 'חדיר',
  'כוננות', 'הסלמ', 'מבזק', 'חירום', 'כטב', 'מל"ט', 'כלי טיס', 'ירי', 'התרע',
  'חיסול', 'סיכול', 'מנהרה', 'מטען', 'חבלה', 'פצוע', 'הרוג', 'נפגע',
  'גרעין', 'נפט', 'סנקצי', 'בורסה', 'דולר', 'ריבית', 'מניות', 'נאסד',
  'חמינאי', 'נסראללה', 'משמרות', 'הורמוז', 'סואץ', 'מנדב', 'בליסטי',
  'מילואים', 'גיוס', 'פינוי', 'מפנים', 'עוטף', 'דרום', 'צפון', 'גבול',
];

const RELEVANCE_KEYWORDS_EN = [
  'israel', 'iran', 'gaza', 'lebanon', 'syria', 'hezbollah', 'hamas', 'idf', 'rocket',
  'missile', 'drone', 'intercept', 'attack', 'strike', 'terror', 'alert', 'escalation',
  'military', 'airstrike', 'casualties', 'ceasefire', 'houthi', 'yemen', 'nuclear',
  'sanctions', 'oil', 'blockade', 'hormuz', 'ballistic', 'irgc', 'khamenei',
  'netanyahu', 'pentagon', 'centcom', 'nato', 'trump', 'war', 'invasion',
  'explosion', 'breaking', 'urgent', 'killed', 'wounded', 'troops',
];

const RELEVANCE_KEYWORDS_AR = [
  'صواريخ', 'قصف', 'غارة', 'إطلاق', 'اشتباك', 'قتلى', 'جرحى', 'اعتراض',
  'إيران', 'حزب الله', 'حماس', 'غزة', 'لبنان', 'سوريا', 'تصعيد',
  'طائرة بدون طيار', 'باليستي', 'نووي', 'عقوبات', 'هرمز',
];

const SPAM_PATTERNS = [
  /casino/i, /binance/i, /crypto.*earn/i, /trading.*profit/i,
  /investment.*guaranteed/i, /forex/i, /earn money/i, /subscribed/i,
  /join.*channel/i, /whatsapp.*group/i,
];

type ParsedPost = {
  channelHandle: string;
  channelLabel: string;
  postUrl: string;
  text: string;
  postedAt: string | null;
};

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
  ).trim();
}

function normalizeForDedup(text: string) {
  return text
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/[\s\-_.,!?:;()\[\]{}#@'"0-9]/g, '')
    .slice(0, 60)
    .toLowerCase();
}

function isSpam(text: string) {
  return SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

function isRelevant(text: string) {
  const lower = text.toLowerCase();
  return (
    RELEVANCE_KEYWORDS_HE.some((kw) => text.includes(kw)) ||
    RELEVANCE_KEYWORDS_EN.some((kw) => lower.includes(kw)) ||
    RELEVANCE_KEYWORDS_AR.some((kw) => text.includes(kw))
  );
}

function extractSeverity(text: string) {
  const lower = text.toLowerCase();
  if (/מבזק|דחוף|אזעקה|צבע אדום|פגיעה ישירה|יירוט|שיגור|נפילה|תקיפה|פיגוע|חיסול|attack|strike|rocket|missile|intercept|killed|explosion|breaking|urgent|صواريخ|قصف|غارة|قتلى/i.test(lower)) return 'critical';
  if (/כוננות|הסלמה|חדירה|כטב|מל"ט|drone|uav|warning|alert|بليستي|تصعيد/i.test(lower)) return 'high';
  if (/עדכון|דיווח|צה"ל|שב"כ|פיקוד העורף|update|report/i.test(lower)) return 'medium';
  return 'low';
}

function classifyCategory(text: string) {
  const lower = text.toLowerCase();
  if (/פיגוע|טרור|חדירה|terror|attack/.test(lower)) return 'terrorism';
  if (/נפט|דולר|בורסה|מניות|ריבית|סנקצי|oil|sanctions|market|stock/.test(lower)) return 'economic';
  if (/איראן|לבנון|סוריה|עזה|חיזבאללה|חמאס|צה"ל|יירוט|שיגור|תקיפה|missile|rocket|idf|hezbollah|hamas/.test(lower)) return 'military';
  if (/הפסקת אש|קבינט|סנקציות|דיפלומט|ceasefire|sanctions|cabinet/.test(lower)) return 'diplomatic';
  return 'general';
}

function extractHeadline(text: string) {
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) || text;
  return firstLine.replace(/\s+/g, ' ').slice(0, 120);
}

function extractPosts(html: string, handle: string, label: string): ParsedPost[] {
  const segments = html.split('data-post="').slice(1);
  const posts: ParsedPost[] = [];

  for (const segment of segments) {
    const postRefEnd = segment.indexOf('"');
    if (postRefEnd === -1) continue;
    const postRef = segment.slice(0, postRefEnd);
    if (!postRef.toLowerCase().startsWith(`${handle.toLowerCase()}/`)) continue;

    const textMatch = segment.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
    if (!textMatch?.[1]) continue;

    const text = stripHtml(textMatch[1]);
    if (!text) continue;

    const postedAt = segment.match(/<time datetime="([^"]+)"/i)?.[1] || null;
    posts.push({
      channelHandle: handle,
      channelLabel: label,
      postUrl: `https://t.me/${postRef}`,
      text,
      postedAt,
    });
  }

  return posts;
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
    const handles = Array.isArray(body?.channels) && body.channels.length > 0
      ? body.channels.map((handle: string) => String(handle))
      : UNIQUE_CHANNELS.map((channel) => channel.handle);

    const channels = handles.map((handle: string) =>
      UNIQUE_CHANNELS.find((channel) => channel.handle === handle) || {
        handle,
        label: `Telegram ${handle}`,
      }
    );

    console.log(`telegram-public-scrape: scanning ${channels.length} channels...`);

    // Scrape in batches of 5 to avoid rate limiting
    const BATCH_SIZE = 5;
    const allPosts: ParsedPost[] = [];
    const channelStatus: Record<string, string> = {};

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (channel: { handle: string; label: string }) => {
        try {
          const response = await fetch(`https://t.me/s/${channel.handle}`, {
            headers: {
              'User-Agent': UA,
              Accept: 'text/html',
              'Accept-Language': 'en-US,en;q=0.9,he;q=0.8,ar;q=0.7',
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            channelStatus[channel.handle] = `error:${response.status}`;
            console.warn(`telegram-public-scrape: ${channel.handle} returned ${response.status}`);
            return [] as ParsedPost[];
          }

          const html = await response.text();
          const posts = extractPosts(html, channel.handle, channel.label);
          channelStatus[channel.handle] = `ok:${posts.length}`;
          return posts;
        } catch (error) {
          channelStatus[channel.handle] = `timeout`;
          console.warn(`telegram-public-scrape: failed ${channel.handle}`, error);
          return [] as ParsedPost[];
        }
      }));
      allPosts.push(...batchResults.flat());

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < channels.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const maxAgeMs = MAX_POST_AGE_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const parsedPosts = allPosts
      .filter((post) => post.text.length >= 12)
      .filter((post) => !isSpam(post.text))
      .filter((post) => isRelevant(post.text))
      .filter((post) => {
        if (!post.postedAt) return true;
        const postedAtMs = new Date(post.postedAt).getTime();
        return Number.isFinite(postedAtMs) ? now - postedAtMs <= maxAgeMs : true;
      });

    const dedupedPosts = parsedPosts.filter((post, index, arr) => {
      const normalized = normalizeForDedup(post.text);
      return arr.findIndex((item) => normalizeForDedup(item.text) === normalized) === index;
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('intel_reports')
      .select('title')
      .like('source', 'telegram_public_%')
      .gte('created_at', since)
      .limit(500);

    const existingTitles = new Set((existing || []).map((row: any) => normalizeForDedup(row.title)));

    let stored = 0;
    const byChannel: Record<string, number> = {};

    for (const post of dedupedPosts) {
      const headline = extractHeadline(post.text);
      const title = `[${post.channelLabel}] ${headline}`;
      const normalizedTitle = normalizeForDedup(title);
      byChannel[post.channelHandle] = (byChannel[post.channelHandle] || 0) + 1;

      if (existingTitles.has(normalizedTitle)) continue;

      const { error } = await supabase.from('intel_reports').insert({
        source: `telegram_public_${post.channelHandle}`,
        category: classifyCategory(post.text),
        title,
        summary: post.text.slice(0, 450),
        severity: extractSeverity(post.text),
        region: 'Global',
        tags: ['telegram', 'public-channel', post.channelHandle, 'flash'],
        raw_data: {
          channel_handle: post.channelHandle,
          channel_label: post.channelLabel,
          post_url: post.postUrl,
          scraped_from: `https://t.me/s/${post.channelHandle}`,
          posted_at: post.postedAt,
        },
      });

      if (!error) {
        stored += 1;
        existingTitles.add(normalizedTitle);
      } else {
        console.error('telegram-public-scrape insert error:', error.message);
      }
    }

    console.log(`telegram-public-scrape: scanned=${allPosts.length}, relevant=${parsedPosts.length}, stored=${stored}`);

    return new Response(JSON.stringify({
      ok: true,
      totalScraped: allPosts.length,
      relevant: parsedPosts.length,
      stored,
      channelStatus,
      channels: channels.map((channel: { handle: string; label: string }) => ({
        handle: channel.handle,
        label: channel.label,
        status: channelStatus[channel.handle] || 'skipped',
        matched: byChannel[channel.handle] || 0,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('telegram-public-scrape error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
