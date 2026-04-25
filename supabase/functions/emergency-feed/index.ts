import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══ Comprehensive Israeli city geocoding ═══
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  // ═══ Major cities ═══
  'תל אביב': { lat: 32.0853, lon: 34.7818 }, 'תל אביב יפו': { lat: 32.0853, lon: 34.7818 },
  'ירושלים': { lat: 31.7683, lon: 35.2137 }, 'חיפה': { lat: 32.7940, lon: 34.9896 },
  'באר שבע': { lat: 31.2530, lon: 34.7915 }, 'אשדוד': { lat: 31.8014, lon: 34.6436 },
  'אשקלון': { lat: 31.6688, lon: 34.5743 }, 'נתניה': { lat: 32.3215, lon: 34.8532 },
  'חולון': { lat: 32.0114, lon: 34.7748 }, 'רמת גן': { lat: 32.0680, lon: 34.8110 },
  'פתח תקווה': { lat: 32.0841, lon: 34.8878 }, 'ראשון לציון': { lat: 31.9730, lon: 34.7925 },
  'הרצליה': { lat: 32.1629, lon: 34.7908 }, 'רחובות': { lat: 31.8928, lon: 34.8113 },
  'שדרות': { lat: 31.5250, lon: 34.5953 }, 'עכו': { lat: 32.9272, lon: 35.0819 },
  'נהריה': { lat: 33.0061, lon: 35.0956 }, 'קריית שמונה': { lat: 33.2073, lon: 35.5712 },
  'צפת': { lat: 32.9646, lon: 35.4960 }, 'טבריה': { lat: 32.7922, lon: 35.5312 },
  'אילת': { lat: 29.5577, lon: 34.9519 }, 'מודיעין': { lat: 31.8969, lon: 34.9614 },
  'בני ברק': { lat: 32.0834, lon: 34.8344 }, 'בת ים': { lat: 32.0231, lon: 34.7518 },
  'כפר סבא': { lat: 32.1780, lon: 34.9065 }, 'רעננה': { lat: 32.1840, lon: 34.8719 },
  'לוד': { lat: 31.9514, lon: 34.8953 }, 'רמלה': { lat: 31.9275, lon: 34.8669 },
  'נתיבות': { lat: 31.4200, lon: 34.5880 }, 'אופקים': { lat: 31.3173, lon: 34.6186 },
  'קריית גת': { lat: 31.6062, lon: 34.7638 }, 'דימונה': { lat: 31.0697, lon: 35.0334 },
  'כרמיאל': { lat: 32.9191, lon: 35.3010 }, 'עפולה': { lat: 32.6080, lon: 35.2880 },
  'גבעתיים': { lat: 32.0716, lon: 34.8096 }, 'הוד השרון': { lat: 32.1504, lon: 34.8915 },
  'ערד': { lat: 31.2593, lon: 35.2127 }, 'יבנה': { lat: 31.8775, lon: 34.7388 },
  'קריית מוצקין': { lat: 32.8367, lon: 35.0738 }, 'קריית אתא': { lat: 32.8040, lon: 35.1070 },
  'נצרת': { lat: 32.6996, lon: 35.3035 }, 'מטולה': { lat: 33.2797, lon: 35.5734 },
  'שלומי': { lat: 33.0730, lon: 35.1440 }, 'מעלות': { lat: 33.0169, lon: 35.2743 },
  'ראש פינה': { lat: 32.9700, lon: 35.5400 }, 'בית שאן': { lat: 32.4972, lon: 35.4960 },
  'מרגליות': { lat: 33.1900, lon: 35.5700 }, 'נטועה': { lat: 33.1000, lon: 35.2700 },
  'שתולה': { lat: 33.0900, lon: 35.2500 }, 'מנרה': { lat: 33.2400, lon: 35.5700 },
  'חצור הגלילית': { lat: 32.9854, lon: 35.5408 }, 'יקנעם': { lat: 32.6590, lon: 35.1080 },
  'עין גדי': { lat: 31.4504, lon: 35.3847 }, 'גדרה': { lat: 31.8133, lon: 34.7796 },
  'קלנסווה': { lat: 32.2848, lon: 34.9733 }, 'טירה': { lat: 32.2341, lon: 34.9528 },
  'אום אל פחם': { lat: 32.5178, lon: 35.1543 }, 'סכנין': { lat: 32.8631, lon: 35.3006 },
  'טמרה': { lat: 32.8517, lon: 35.1977 }, 'רהט': { lat: 31.3930, lon: 34.7540 },
  'כפר קאסם': { lat: 32.1139, lon: 34.9762 }, 'טייבה': { lat: 32.2656, lon: 34.9871 },
  // ═══ Gush Dan & Center ═══
  'גבעת שמואל': { lat: 32.08, lon: 34.85 }, 'אור יהודה': { lat: 32.03, lon: 34.86 },
  'יהוד מונוסון': { lat: 32.03, lon: 34.88 }, 'קרית אונו': { lat: 32.06, lon: 34.86 },
  'אלעד': { lat: 32.05, lon: 34.95 }, 'שוהם': { lat: 31.99, lon: 34.95 },
  'אזור': { lat: 32.03, lon: 34.79 }, 'רמת השרון': { lat: 32.14, lon: 34.84 },
  'כפר יונה': { lat: 32.32, lon: 34.93 }, 'אבן יהודה': { lat: 32.27, lon: 34.89 },
  'נס ציונה': { lat: 31.93, lon: 34.80 }, 'גן יבנה': { lat: 31.79, lon: 34.71 },
  'מודיעין עילית': { lat: 31.93, lon: 35.04 }, 'מודיעין מכבים רעות': { lat: 31.90, lon: 34.96 },
  // ═══ Haifa area ═══
  'טירת כרמל': { lat: 32.76, lon: 34.97 }, 'נשר': { lat: 32.77, lon: 35.04 },
  'קריית ביאליק': { lat: 32.83, lon: 35.09 }, 'קריית ים': { lat: 32.84, lon: 35.07 },
  'רכסים': { lat: 32.76, lon: 35.08 }, 'דלית אל כרמל': { lat: 32.69, lon: 35.05 },
  'עוספיא': { lat: 32.72, lon: 35.07 }, 'עתלית': { lat: 32.69, lon: 34.94 },
  'זכרון יעקב': { lat: 32.57, lon: 34.95 }, 'פרדס חנה כרכור': { lat: 32.47, lon: 34.97 },
  'אור עקיבא': { lat: 32.51, lon: 34.92 }, 'קיסריה': { lat: 32.51, lon: 34.89 },
  // ═══ Sharon ═══
  'חדרה': { lat: 32.44, lon: 34.92 }, 'בנימינה גבעת עדה': { lat: 32.52, lon: 34.95 },
  // ═══ North — Upper Galilee ═══
  'כפר גלעדי': { lat: 33.24, lon: 35.57 }, 'כפר יובל': { lat: 33.23, lon: 35.59 },
  'משגב עם': { lat: 33.26, lon: 35.56 }, 'גשר הזיו': { lat: 33.03, lon: 35.10 },
  'מעלות תרשיחא': { lat: 33.02, lon: 35.27 }, 'חניתה': { lat: 33.09, lon: 35.15 },
  'אביבים': { lat: 33.16, lon: 35.48 }, 'יפתח': { lat: 33.16, lon: 35.52 },
  'דן': { lat: 33.23, lon: 35.65 }, 'שניר': { lat: 33.27, lon: 35.62 },
  'הגושרים': { lat: 33.22, lon: 35.62 }, 'כפר בלום': { lat: 33.17, lon: 35.62 },
  'תל חי': { lat: 33.23, lon: 35.57 }, 'נאות מרדכי': { lat: 33.16, lon: 35.60 },
  'דפנה': { lat: 33.22, lon: 35.64 }, 'שאר ישוב': { lat: 33.22, lon: 35.64 },
  'ביריה': { lat: 32.99, lon: 35.49 }, 'עלמה': { lat: 33.01, lon: 35.51 },
  // ═══ North — Golan ═══
  'קצרין': { lat: 32.99, lon: 35.69 }, 'מג\'דל שמס': { lat: 33.27, lon: 35.77 },
  'מסעדה': { lat: 33.24, lon: 35.75 }, 'בוקעאתא': { lat: 33.21, lon: 35.77 },
  // ═══ Western Galilee ═══
  'כברי': { lat: 33.02, lon: 35.14 }, 'שבי ציון': { lat: 32.99, lon: 35.08 },
  'פסוטה': { lat: 33.05, lon: 35.24 }, 'מעיליא': { lat: 33.03, lon: 35.26 },
  // ═══ Jezreel Valley ═══
  'נוף הגליל': { lat: 32.72, lon: 35.33 }, 'נצרת עילית': { lat: 32.72, lon: 35.33 },
  'מגדל העמק': { lat: 32.68, lon: 35.24 }, 'רמת ישי': { lat: 32.70, lon: 35.17 },
  'כפר תבור': { lat: 32.69, lon: 35.42 },
  // ═══ Gaza Envelope ═══
  'שער הנגב': { lat: 31.50, lon: 34.55 }, 'עוטף עזה': { lat: 31.45, lon: 34.45 },
  'ניר עוז': { lat: 31.34, lon: 34.40 }, 'בארי': { lat: 31.43, lon: 34.49 },
  'רעים': { lat: 31.41, lon: 34.47 }, 'נחל עוז': { lat: 31.48, lon: 34.49 },
  'כפר עזה': { lat: 31.48, lon: 34.47 }, 'זיקים': { lat: 31.62, lon: 34.52 },
  'יד מרדכי': { lat: 31.59, lon: 34.55 }, 'נתיב העשרה': { lat: 31.56, lon: 34.51 },
  'כיסופים': { lat: 31.38, lon: 34.40 }, 'נירים': { lat: 31.36, lon: 34.40 },
  'סופה': { lat: 31.23, lon: 34.28 }, 'תקומה': { lat: 31.44, lon: 34.53 },
  'מפלסים': { lat: 31.47, lon: 34.53 },
  // ═══ Shfela & South ═══
  'קריית מלאכי': { lat: 31.73, lon: 34.75 },
  // ═══ Negev ═══
  'ירוחם': { lat: 30.99, lon: 34.93 }, 'שגב שלום': { lat: 31.25, lon: 34.85 },
  'להבים': { lat: 31.37, lon: 34.81 }, 'עומר': { lat: 31.27, lon: 34.84 },
  'מיתר': { lat: 31.33, lon: 34.93 }, 'ערערה בנגב': { lat: 31.15, lon: 34.79 },
  // ═══ Jerusalem corridor ═══
  'מבשרת ציון': { lat: 31.80, lon: 35.15 }, 'מעלה אדומים': { lat: 31.78, lon: 35.30 },
  'גבעת זאב': { lat: 31.86, lon: 35.17 }, 'ביתר עילית': { lat: 31.70, lon: 35.12 },
  'אפרת': { lat: 31.66, lon: 35.16 }, 'גוש עציון': { lat: 31.66, lon: 35.12 },
  // ═══ Judea & Samaria ═══
  'אריאל': { lat: 32.10, lon: 35.17 }, 'קרני שומרון': { lat: 32.17, lon: 35.10 },
  'חברון': { lat: 31.53, lon: 35.10 }, 'קריית ארבע': { lat: 31.53, lon: 35.12 },
  'בית לחם': { lat: 31.71, lon: 35.21 },
  // ═══ Arava & Eilat ═══
  'יטבתה': { lat: 29.88, lon: 35.06 }, 'באר אורה': { lat: 29.73, lon: 35.01 },
  // ═══ Arab cities ═══
  'שפרעם': { lat: 32.81, lon: 35.17 }, 'באקה אל-גרבייה': { lat: 32.42, lon: 35.04 },
  'אכסאל': { lat: 32.66, lon: 35.33 }, 'ריינה': { lat: 32.72, lon: 35.31 },
  'כפר כנא': { lat: 32.75, lon: 35.34 }, 'כפר מנדא': { lat: 32.78, lon: 35.26 },
  'עראבה': { lat: 32.85, lon: 35.33 }, 'דיר חנא': { lat: 32.87, lon: 35.37 },
};

// Short city names that cause false-positive geocoding when they appear as part of compound names
const AMBIGUOUS_CITIES = new Set(['אזור', 'דן', 'לוד', 'ערד', 'גן']);

function findCityCoords(text: string): { lat: number; lon: number; city: string } | null {
  // Try longest city name first for accuracy (e.g. "תל אביב יפו" before "תל אביב")
  const sorted = Object.entries(CITY_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [city, coords] of sorted) {
    if (!text.includes(city)) continue;
    // For ambiguous short city names, require exact word boundary (not part of a compound like "אזור תעשייה")
    if (AMBIGUOUS_CITIES.has(city)) {
      // Match only if city name stands alone (preceded/followed by space, comma, start/end, or punctuation)
      const regex = new RegExp(`(?:^|[\\s,:\\-])${city}(?:$|[\\s,:\\-])`);
      if (!regex.test(text)) continue;
    }
    return { ...coords, city };
  }
  return null;
}

// Water-adjacent cities — drowning events only valid here
const WATER_CITIES = new Set([
  'תל אביב', 'חיפה', 'אשדוד', 'אשקלון', 'הרצליה', 'נתניה', 'בת ים',
  'עכו', 'נהריה', 'אילת', 'טבריה', 'עין גדי', 'חולון', 'ראשון לציון',
]);

function isDrowningValid(text: string, city: string | null): boolean {
  // Check if text explicitly mentions water body
  if (/בים|בבריכה|בנחל|בכנרת|בנהר|חוף|במאגר|ים המלח/.test(text)) return true;
  // Check if event is in a coastal/lakeside city
  if (city && WATER_CITIES.has(city)) return true;
  return false;
}

function scoreEvent(text: string): { score: number; color: string } {
  const keywords: Record<string, number> = {
    'אזעקה': 2, 'שיגור': 2, 'ירי': 2, 'חדירה': 3, 'תקיפה': 2, 'פיגוע': 3,
    'טיל': 2, 'רקטה': 2, 'פיצוץ': 2, 'הרוגים': 3, 'פצועים': 2, 'הרוג': 3,
    'תאונה': 1, 'שריפה': 2, 'חילוץ': 1, 'הצלה': 1, 'כיבוי': 2,
    'קריסה': 2, 'טביעה': 1, 'דקירה': 2,
    'נפילה': 2, 'פגיעה ישירה': 3, 'נזק כבד': 3,
    'לכודים': 3, 'חומרים מסוכנים': 3, 'דליקה': 2,
    'רסיסים': 2, 'אמבולנס': 1, 'פינוי': 1,
    'missiles': 2, 'rocket': 2, 'terror': 3,
  };
  let score = 0;
  for (const [kw, val] of Object.entries(keywords)) {
    if (text.includes(kw)) score += val;
  }
  // Validate: if text mentions "טביעה" generically, only score if near water
  const hasDrowning = /טביעה/.test(text);
  if (hasDrowning && !/בים|בבריכה|בנחל|בכנרת|בנהר|חוף|במאגר/.test(text)) {
    score = Math.max(score - 1, 0); // reduce false-positive score
  }
  score = Math.min(score, 10);
  const color = score <= 3 ? 'green' : score <= 6 ? 'orange' : 'red';
  return { score, color };
}

function parseRSS(xml: string): Array<{ title: string; description: string; pubDate: string; link: string }> {
  const items: Array<{ title: string; description: string; pubDate: string; link: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return (m?.[1] || m?.[2] || '').trim();
    };
    items.push({
      title: getTag('title'),
      description: getTag('description'),
      pubDate: getTag('pubDate'),
      link: getTag('link'),
    });
  }
  return items;
}

// Simple content hash for deduplication
function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let totalProcessed = 0;
  const errors: string[] = [];
  const sources: string[] = [];

  // Get existing content hashes for deduplication (last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('emergency_events')
    .select('title, source')
    .gte('created_at', sixHoursAgo);
  const existingKeys = new Set((existing || []).map((e: any) => `${e.source}:${hashContent(e.title)}`));

  async function insertEvent(row: any) {
    const key = `${row.source}:${hashContent(row.title)}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    const { error } = await supabase.from('emergency_events').insert(row);
    if (!error) { totalProcessed++; return true; }
    return false;
  }

  // ═══ 1. Ynet Breaking News (Emergency filter) ═══
  try {
    const resp = await fetch('https://www.ynet.co.il/Integration/StoryRss1854.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const xml = await resp.text();
      if (xml.includes('<item>')) {
        const items = parseRSS(xml);
        for (const item of items.slice(0, 30)) {
          const fullText = `${item.title} ${item.description}`;
          const isEmergency = /פיגוע|ירי|פיצוץ|רקטה|טיל|אזעקה|פצוע|הרוג|תאונ|שריפה|חילוץ|דקירה|אירוע ביטחוני|נפילה|רסיסים|פגיעה|אמבולנס|מד"א|כיבוי|חשד/.test(fullText);
          if (!isEmergency) continue;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `📰 ${item.title}`,
            description: item.description?.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'news_ynet', event_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            score, color,
            raw_data: { link: item.link, pubDate: item.pubDate },
          });
        }
        sources.push('ynet');
      }
    } else { errors.push(`ynet: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`ynet: ${(e as Error).message}`); }

  // ═══ 2. Walla News Breaking ═══
  try {
    const resp = await fetch('https://rss.walla.co.il/feed/22', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const xml = await resp.text();
      if (xml.includes('<item>')) {
        const items = parseRSS(xml);
        for (const item of items.slice(0, 20)) {
          const fullText = `${item.title} ${item.description}`;
          const isEmergency = /פיגוע|ירי|פיצוץ|רקטה|טיל|אזעקה|פצוע|הרוג|תאונ|שריפה|חילוץ|דקירה|אירוע ביטחוני|נפילה|פגיעה|אמבולנס|מד"א|כיבוי|חשד|משטרה/.test(fullText);
          if (!isEmergency) continue;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `📰 ${item.title}`,
            description: item.description?.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'news_walla', event_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            score, color,
            raw_data: { link: item.link, pubDate: item.pubDate },
          });
        }
        sources.push('walla');
      }
    } else { errors.push(`walla: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`walla: ${(e as Error).message}`); }

  // ═══ 3. Mako/N12 Breaking News ═══
  try {
    const resp = await fetch('https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000004801000aRCRD.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const xml = await resp.text();
      if (xml.includes('<item>')) {
        const items = parseRSS(xml);
        for (const item of items.slice(0, 20)) {
          const fullText = `${item.title} ${item.description}`;
          const isEmergency = /פיגוע|ירי|פיצוץ|רקטה|טיל|אזעקה|פצוע|הרוג|תאונ|שריפה|חילוץ|דקירה|ביטחוני|נפילה|פגיעה|אמבולנס|מד"א|כיבוי|חשד|משטרה/.test(fullText);
          if (!isEmergency) continue;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `📺 ${item.title}`,
            description: item.description?.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'news_n12', event_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            score, color,
            raw_data: { link: item.link, pubDate: item.pubDate },
          });
        }
        sources.push('n12');
      }
    } else { errors.push(`n12: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`n12: ${(e as Error).message}`); }

  // ═══ 4. Kan News (Public Broadcasting) ═══
  try {
    const resp = await fetch('https://www.kan.org.il/lobby/kan-news/rss/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const xml = await resp.text();
      if (xml.includes('<item>')) {
        const items = parseRSS(xml);
        for (const item of items.slice(0, 20)) {
          const fullText = `${item.title} ${item.description}`;
          const isEmergency = /פיגוע|ירי|פיצוץ|רקטה|טיל|אזעקה|פצוע|הרוג|תאונ|שריפה|חילוץ|דקירה|ביטחוני|נפילה|פגיעה|מד"א|כיבוי|משטרה/.test(fullText);
          if (!isEmergency) continue;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `📻 ${item.title}`,
            description: item.description?.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'news_kan', event_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            score, color,
            raw_data: { link: item.link, pubDate: item.pubDate },
          });
        }
        sources.push('kan');
      }
    } else { errors.push(`kan: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`kan: ${(e as Error).message}`); }

  // ═══ 5. MDA RSS Feed ═══
  try {
    const resp = await fetch('https://www.mdais.org/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const xml = await resp.text();
      if (xml.includes('<item>')) {
        const items = parseRSS(xml);
        for (const item of items.slice(0, 20)) {
          const fullText = `${item.title} ${item.description}`;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `🚑 ${item.title}`,
            description: item.description?.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'mda_rss', event_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            score, color,
            raw_data: { link: item.link, pubDate: item.pubDate },
          });
        }
        sources.push('mda');
      }
    } else { errors.push(`mda: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`mda: ${(e as Error).message}`); }

  // ═══ 6. Israel Police RSS / gov.il ═══
  try {
    const resp = await fetch('https://www.gov.il/he/api/PublicationApi/Index?limit=15&OfficeId=d1dcc2a8-4450-4e5c-b003-17c531e0e8f2&skip=0', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const results = data?.results || data || [];
      if (Array.isArray(results)) {
        for (const item of results.slice(0, 15)) {
          const title = item.Title || item.title || '';
          const desc = item.Description || item.description || '';
          const fullText = `${title} ${desc}`;
          const isEmergency = /פיגוע|ירי|דקירה|תאונ|מרדף|חשוד|נעצר|משטרה|מחסום|פשיעה|אלימות/.test(fullText);
          if (!isEmergency && !title) continue;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `🚔 ${title.slice(0, 120)}`,
            description: desc.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'police_gov', event_time: item.publishDate || new Date().toISOString(),
            score, color,
            raw_data: { gov_id: item.Id || item.id, type: 'police' },
          });
        }
        sources.push('police');
      }
    } else { errors.push(`police: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`police: ${(e as Error).message}`); }

  // ═══ 7. Fire Department gov.il ═══
  try {
    const resp = await fetch('https://www.gov.il/he/api/PublicationApi/Index?limit=15&OfficeId=41df1bf1-66f4-4961-a39b-39b658c711ba&skip=0', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const results = data?.results || data || [];
      if (Array.isArray(results)) {
        for (const item of results.slice(0, 15)) {
          const title = item.Title || item.title || '';
          const desc = item.Description || item.description || '';
          const fullText = `${title} ${desc}`;
          const coords = findCityCoords(fullText);
          const { score, color } = scoreEvent(fullText);
          await insertEvent({
            title: `🚒 ${title.slice(0, 120)}`,
            description: desc.slice(0, 500) || null,
            location: coords?.city || null,
            lat: coords?.lat || null, lon: coords?.lon || null,
            source: 'fire_gov', event_time: item.publishDate || new Date().toISOString(),
            score, color,
            raw_data: { gov_id: item.Id || item.id, type: 'fire' },
          });
        }
        sources.push('fire');
      }
    } else { errors.push(`fire: HTTP ${resp.status}`); }
  } catch (e) { errors.push(`fire: ${(e as Error).message}`); }

  // ═══ 8. Telegram emergency messages ═══
  try {
    const { data: tgMessages } = await supabase
      .from('telegram_messages')
      .select('*')
      .not('text', 'is', null)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (tgMessages && tgMessages.length > 0) {
      for (const msg of tgMessages) {
        if (!msg.text) continue;
        const text = msg.text;
        const isEmergency = /מד"א|מדא|כיבוי|שריפה|פיגוע|ירי|פיצוץ|רקטה|טיל|אזעקה|פצוע|הרוג|תאונ|חילוץ|לכודים|משטרה|דקירה/.test(text);
        if (!isEmergency) continue;
        const coords = findCityCoords(text);
        const { score, color } = scoreEvent(text);
        let source = 'telegram_emergency';
        if (/מד"א|מדא|אמבולנס|פצוע|הרוג/.test(text)) source = 'mda_telegram';
        else if (/כיבוי|שריפה|דליקה|לכודים/.test(text)) source = 'fire_telegram';
        else if (/משטרה|פיגוע|דקירה|ירי/.test(text)) source = 'police_telegram';
        const title = text.split('\n')[0]?.slice(0, 100) || text.slice(0, 100);
        await insertEvent({
          title: `📡 ${title}`,
          description: text.slice(0, 500),
          location: coords?.city || null,
          lat: coords?.lat || null, lon: coords?.lon || null,
          source, event_time: msg.message_date || msg.created_at,
          score, color,
          raw_data: { telegram_msg_id: msg.id, chat_id: msg.chat_id, sender: msg.sender_name },
        });
      }
      sources.push('telegram');
    }
  } catch (e) { errors.push(`telegram: ${(e as Error).message}`); }

  // ═══ 9. Tzeva Adom alerts → also insert as emergency_events ═══
  try {
    const tzResp = await fetch('https://api.tzevaadom.co.il/notifications', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (tzResp.ok) {
      const text = await tzResp.text();
      const clean = text.replace(/^\uFEFF/, '').trim();
      if (clean && clean.length > 2 && !clean.startsWith('<')) {
        const data = JSON.parse(clean);
        const alerts = Array.isArray(data) ? data : (data?.notifications || []);
        for (const alert of alerts.slice(0, 20)) {
          const cities = alert.cities || alert.data || [];
          const alertTitle = Array.isArray(cities) ? cities.join(', ') : (alert.title || 'התרעה');
          for (const city of (Array.isArray(cities) ? cities : [alertTitle])) {
            const coords = findCityCoords(city);
            await insertEvent({
              title: `🚨 התרעה: ${city}`,
              description: `התרעת פיקוד העורף — ${alertTitle}`,
              location: coords?.city || city,
              lat: coords?.lat || null, lon: coords?.lon || null,
              source: 'oref_realtime', event_time: new Date().toISOString(),
              score: 8, color: 'red',
              raw_data: { oref: true, threat: alert.threat, isDrill: alert.isDrill },
            });
          }
        }
        sources.push('tzevaadom');
      }
    }
  } catch (e) { errors.push(`tzevaadom: ${(e as Error).message}`); }

  return new Response(JSON.stringify({
    ok: true,
    processed: totalProcessed,
    sources,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
