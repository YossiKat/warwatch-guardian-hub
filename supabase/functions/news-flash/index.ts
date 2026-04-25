import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

// ── News sources: Israeli + International ──
const NEWS_FEEDS = [
  // Israeli channels
  { id: 'ch12', name: 'ערוץ 12', nameEn: 'Channel 12', icon: '📺', color: '#e91e63',
    urls: ['https://www.mako.co.il/news-military', 'https://www.mako.co.il/news-politics'],
    rss: 'https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000004801000aRCRD.xml' },
  { id: 'n12', name: 'N12 חדשות', nameEn: 'N12 News', icon: '📺', color: '#d50000',
    urls: ['https://www.n12.co.il/'],
    rss: 'https://www.n12.co.il/TagLineRSS.xml' },
  { id: 'ch13', name: 'ערוץ 13', nameEn: 'Channel 13', icon: '📺', color: '#ff5722',
    urls: ['https://13tv.co.il/news/security/'],
    rss: null },
  { id: 'ch11', name: 'כאן 11', nameEn: 'Kan 11', icon: '📺', color: '#2196f3',
    urls: ['https://www.kan.org.il/lobby/defense/'],
    rss: 'https://www.kan.org.il/rss/' },
  { id: 'police_il', name: 'משטרת ישראל', nameEn: 'Israel Police', icon: '🚔', color: '#1a237e',
    urls: ['https://www.police.gov.il/'],
    rss: 'https://www.police.gov.il/rss.aspx' },
  { id: 'ynet', name: 'ynet', nameEn: 'ynet', icon: '📱', color: '#ff0000',
    urls: ['https://www.ynet.co.il/news/category/184', 'https://www.ynet.co.il/news/category/194'],
    rss: 'https://www.ynet.co.il/Integration/StoryRss184.xml' },
  { id: 'walla', name: 'וואלה', nameEn: 'Walla', icon: '📱', color: '#00bcd4',
    urls: ['https://news.walla.co.il/category/2689'],
    rss: 'https://rss.walla.co.il/feed/1?type=main' },
  // International
  { id: 'cnn', name: 'CNN', nameEn: 'CNN', icon: '🌐', color: '#cc0000',
    urls: ['https://edition.cnn.com/middle-east'],
    rss: 'http://rss.cnn.com/rss/edition_meast.rss' },
  { id: 'foxnews', name: 'Fox News', nameEn: 'Fox News', icon: '🦊', color: '#003580',
    urls: ['https://www.foxnews.com/category/world/conflicts/israel'],
    rss: 'https://moxie.foxnews.com/google-publisher/world.xml' },
  { id: 'aljazeera', name: 'אל ג\'זירה', nameEn: 'Al Jazeera', icon: '🌍', color: '#d4a843',
    urls: ['https://www.aljazeera.com/where/israel/', 'https://www.aljazeera.com/where/palestine/'],
    rss: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'reuters', name: 'רויטרס', nameEn: 'Reuters', icon: '📰', color: '#ff8800',
    urls: ['https://www.reuters.com/world/middle-east/'],
    rss: 'https://news.google.com/rss/search?q=reuters+middle+east+OR+israel+OR+iran&hl=en&gl=US&ceid=US:en' },
  { id: 'bbc', name: 'BBC', nameEn: 'BBC', icon: '🇬🇧', color: '#bb1919',
    urls: ['https://www.bbc.com/news/world/middle_east'],
    rss: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { id: 'wsj', name: 'וול סטריט ג\'ורנל', nameEn: 'Wall Street Journal', icon: '📊', color: '#0274b6',
    urls: ['https://www.wsj.com/world/middle-east'],
    rss: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  { id: 'nyt', name: 'ניו יורק טיימס', nameEn: 'New York Times', icon: '🗞️', color: '#1a1a1a',
    urls: ['https://www.nytimes.com/section/world/middleeast'],
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml' },
  // Iran sources — using Google News as proxy for blocked domains
  { id: 'irna', name: 'סוכנות IRNA', nameEn: 'IRNA (Iran)', icon: '🇮🇷', color: '#4caf50',
    urls: ['https://en.irna.ir/service/news-service/top-stories'],
    rss: 'https://news.google.com/rss/search?q=site:irna.ir+OR+IRNA+iran&hl=en&gl=US&ceid=US:en' },
  { id: 'tasnim', name: 'תסנים', nameEn: 'Tasnim (Iran)', icon: '🇮🇷', color: '#388e3c',
    urls: ['https://www.tasnimnews.com/en/news/military'],
    rss: 'https://news.google.com/rss/search?q=site:tasnimnews.com+OR+tasnim+iran+military&hl=en&gl=US&ceid=US:en' },
  { id: 'fars', name: 'פארס', nameEn: 'Fars (Iran)', icon: '🇮🇷', color: '#2e7d32',
    urls: ['https://www.farsnews.ir/en/news-service/defense-military'],
    rss: 'https://news.google.com/rss/search?q=site:farsnews.ir+OR+fars+news+iran&hl=en&gl=US&ceid=US:en' },
  // IDF Spokesperson
  { id: 'idf', name: 'דובר צה"ל', nameEn: 'IDF Spokesperson', icon: '🇮🇱', color: '#4a5568',
    urls: ['https://www.idf.il/en/mini-sites/press-releases/'],
    rss: 'https://news.google.com/rss/search?q=site:idf.il+OR+"IDF+spokesperson"&hl=en&gl=US&ceid=US:en' },
  // NATO
  { id: 'nato', name: 'נאט"ו', nameEn: 'NATO', icon: '🏛️', color: '#003399',
    urls: ['https://www.nato.int/cps/en/natohq/news.htm'],
    rss: 'https://news.google.com/rss/search?q=NATO+military+OR+defense+OR+deployment&hl=en&gl=US&ceid=US:en' },
  // Gulf States
  { id: 'gulfnews', name: 'גאלף ניוז', nameEn: 'Gulf News (UAE)', icon: '🇦🇪', color: '#009688',
    urls: ['https://gulfnews.com/world/mena'],
    rss: 'https://gulfnews.com/cmlink/1.446498' },
  { id: 'arabnews', name: 'ערב ניוז', nameEn: 'Arab News (Saudi)', icon: '🇸🇦', color: '#00796b',
    urls: ['https://www.arabnews.com/middleeast'],
    rss: 'https://www.arabnews.com/rss.xml' },
  { id: 'thenational', name: 'דה נשיונל', nameEn: 'The National (UAE)', icon: '🇦🇪', color: '#00695c',
    urls: ['https://www.thenationalnews.com/mena/'],
    rss: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml' },
  // Russia & China
  { id: 'rt', name: 'RT רוסיה', nameEn: 'RT (Russia)', icon: '🇷🇺', color: '#4caf50',
    urls: ['https://www.rt.com/news/'],
    rss: 'https://www.rt.com/rss/news/' },
  { id: 'tass', name: 'TASS רוסיה', nameEn: 'TASS (Russia)', icon: '🇷🇺', color: '#1b5e20',
    urls: ['https://tass.com/world'],
    rss: 'https://tass.com/rss/v2.xml' },
  { id: 'scmp', name: 'SCMP סין', nameEn: 'SCMP (China)', icon: '🇨🇳', color: '#f44336',
    urls: ['https://www.scmp.com/topics/middle-east'],
    rss: 'https://www.scmp.com/rss/91/feed' },
  { id: 'xinhua', name: 'שינחואה סין', nameEn: 'Xinhua (China)', icon: '🇨🇳', color: '#d32f2f',
    urls: ['http://english.news.cn/world/'],
    rss: 'http://www.xinhuanet.com/english/rss/worldrss.xml' },
  // Economic impact
  { id: 'ft', name: 'פייננשל טיימס', nameEn: 'Financial Times', icon: '💰', color: '#f5c242',
    urls: ['https://www.ft.com/middle-east-africa'],
    rss: 'https://www.ft.com/rss/home' },
  { id: 'bloomberg', name: 'בלומברג', nameEn: 'Bloomberg', icon: '📈', color: '#ff9100',
    urls: ['https://www.bloomberg.com/middle-east'],
    rss: null },
  // ═══ Israeli Financial / Business ═══
  { id: 'globes', name: 'גלובס', nameEn: 'Globes', icon: '📊', color: '#1565c0',
    urls: ['https://www.globes.co.il/news/'],
    rss: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585' },
  { id: 'globes_market', name: 'גלובס שוק ההון', nameEn: 'Globes Markets', icon: '📈', color: '#0d47a1',
    urls: ['https://www.globes.co.il/news/tag.aspx?did=585'],
    rss: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2' },
  { id: 'themarker', name: 'דהמרקר', nameEn: 'TheMarker', icon: '💹', color: '#00897b',
    urls: ['https://www.themarker.com/markets', 'https://www.themarker.com/wallstreet'],
    rss: 'https://www.themarker.com/cmlink/1.145' },
  { id: 'themarker_realestate', name: 'דהמרקר נדל"ן', nameEn: 'TheMarker Real Estate', icon: '🏠', color: '#00695c',
    urls: ['https://www.themarker.com/realestate'],
    rss: 'https://www.themarker.com/cmlink/1.147' },
  { id: 'calcalist', name: 'כלכליסט', nameEn: 'Calcalist', icon: '💰', color: '#e65100',
    urls: ['https://www.calcalist.co.il/markets', 'https://www.calcalist.co.il/finance'],
    rss: 'https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml' },
  { id: 'bizportal', name: 'ביזפורטל', nameEn: 'Bizportal', icon: '📊', color: '#283593',
    urls: ['https://www.bizportal.co.il/capitalmarket/news'],
    rss: null },
  // ═══ International Financial ═══
  { id: 'cnbc', name: 'CNBC', nameEn: 'CNBC', icon: '📺', color: '#005594',
    urls: ['https://www.cnbc.com/world-markets/'],
    rss: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362' },
  { id: 'marketwatch', name: 'מרקטווטש', nameEn: 'MarketWatch', icon: '📉', color: '#2e7d32',
    urls: ['https://www.marketwatch.com/latest-news'],
    rss: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { id: 'investing', name: 'Investing.com', nameEn: 'Investing.com', icon: '📊', color: '#0d6e3f',
    urls: ['https://www.investing.com/news/'],
    rss: 'https://www.investing.com/rss/news.rss' },
  { id: 'yahoo_finance', name: 'יאהו פייננס', nameEn: 'Yahoo Finance', icon: '💵', color: '#6001d2',
    urls: ['https://finance.yahoo.com/'],
    rss: 'https://finance.yahoo.com/news/rssindex' },
  { id: 'economist', name: 'האקונומיסט', nameEn: 'The Economist', icon: '🏛️', color: '#e3120b',
    urls: ['https://www.economist.com/finance-and-economics/'],
    rss: 'https://www.economist.com/finance-and-economics/rss.xml' },
];

const UA = 'Mozilla/5.0 (compatible; WarWatch/2.0; +https://warwatch-guardian-hub.lovable.app)';

const RELEVANCE_KEYWORDS_HE = [
  // IMMEDIATE RED ALERTS / HOME FRONT
  'פיצוץ', 'שיגור', 'צבע אדום', 'נפילה', 'יירוט', 'חדירה', 'חילופי אש', 'סיכול', 'תקיפה',
  'חלל', 'חדירת כטב"ם', 'פגיעה ישירה', 'התרעה', 'כניסה למרחב מוגן', 'מסר אישי',
  'טיל', 'רקטה', 'אזעקה', 'פיקוד העורף', 'צה"ל', 'חיזבאללה', 'חמאס', 'סירנה',
  // PRE-LAUNCH / LAUNCH DETECTION
  'זיהוי שיגור', 'התרעת שיגור', 'שיגור מאיראן', 'שיגור טילים', 'שיגור בליסטי',
  'העברת טילים', 'טעינת משגרים', 'כוננות שיגור', 'התראה לפני שיגור', 'גילוי מוקדם',
  'לוויין ביטחוני', 'מכ"ם', 'חץ', 'כיפת ברזל', 'שרביט קסמים', 'דיוויד סלינג',
  'מערך הגנה אווירית', 'יירוט בליסטי', 'טיל שיוט', 'טיל קרקע-קרקע',
  // LEADER STATEMENTS & DECLARATIONS
  'הצהרה', 'הצהרת', 'נאום', 'הודעה רשמית', 'מסיבת עיתונאים', 'הכריז', 'הזהיר', 'איים',
  'חמינאי', 'פזשכיאן', 'נסראללה', 'נסרללה', 'סינוואר', 'הנייה', 'משה דיין',
  'ראש ממשלה', 'נתניהו', 'שר הביטחון', 'הרמטכ"ל', 'דובר צה"ל',
  'מנהיג עליון', 'משמרות המהפכה', 'חיל קודס', 'IRGC',
  'איום ישיר', 'גמול', 'נקמה', 'תגובה', 'מתקפת תגמול', 'תגובה קשה',
  // FIELD UPDATES
  'שחרור', 'חזרה לשגרה', 'הנחיות', 'סיום אירוע', 'דיווח ראשוני',
  // EMERGENCY & MEDICAL
  'מצב חירום', 'פצועים', 'הרוגים', 'נפגעים', 'אנוש', 'קשה', 'פינוי רפואי',
  'מסוק חילוץ', 'תאג"ד', 'מד"א', 'אירוע רב נפגעים', 'אר"ן', 'חסימת עורקים',
  'טיפול תחת אש', 'פינוי',
  // MILITARY MOVEMENTS
  'ריכוז כוחות', 'תנועת שיירות', 'גיוס מילואים', 'כוננות שיא', 'פריסת סוללות',
  'הקפצה', 'שיירה', 'מובילים', 'כוננות', 'מילואים', 'מבצע', 'חייל', 'קרב',
  'הסלמה', 'הפסקת אש', 'חטופים', 'כוחות',
  // STRATEGIC WEAPONS
  'גרעין', 'טילים בליסטיים', 'צנטריפוגות', 'פרויקט הדיוק', 'כטב"ם', 'מל"ט',
  'מל"ט מתאבד', 'צוללת', 'נושאת מטוסים',
  // INFRASTRUCTURE / CYBER
  'הפסקת חשמל', 'קריסת רשת', 'שיבושי GPS', 'לוחמת סייבר', 'מתקפת מנע', 'ניתוק', 'חושך',
  'סייבר', 'האקר', 'מתקפת סייבר', 'פריצה',
  // GEOPOLITICAL
  'איראן', 'גבול', 'עזה', 'לבנון', 'סוריה', 'תימן', 'חות\'ים', 'עיראק',
  'ביטחון', 'מודיעין', 'משטרה', 'כיבוי', 'הבית הלבן', 'טראמפ', 'ביידן', 'סנקציות', 'הסכם',
  // GEOPOLITICAL CHOKEPOINTS
  'מיצרי הורמוז', 'באב אל מנדב', 'חסימה', 'תפיסת ספינה', 'תעלת סואץ', 'מיצר טאיוואן',
  'נתיבי שיט',
  // POLITICAL STABILITY
  'הפיכה', 'מרד', 'הכרזת מלחמה', 'נאום דרמטי', 'סגר', 'עוצר', 'חוסר יציבות',
  // GLOBAL DYNAMICS
  'סחר חוץ', 'ברית אסטרטגית', 'וטו', 'מועצת הביטחון',
  // FINANCE / MACRO
  'בורסה', 'מניות', 'שוק ההון', 'דולר', 'שקל', 'אינפלציה', 'ריבית', 'בנק ישראל',
  'נפט', 'זהב', 'מדד', 'תל אביב 35', 'תל אביב 125', 'נאסד"ק', 'וול סטריט',
  'מט"ח', 'אג"ח', 'תשואה', 'גירעון', 'תקציב', 'דירוג אשראי', 'מיתון',
  'כלכלה', 'יצוא', 'יבוא', 'סחר', 'נדל"ן', 'דיור', 'משכנתא',
  'מחירי הנפט', 'משבר אנרגיה', 'שרשרת אספקה',
  // TERRORISM
  'פיגוע', 'חדירה', 'מנהרה', 'דקירה', 'רעידה', 'הפצצה', 'ירי',
];

const RELEVANCE_KEYWORDS_AR = [
  // IMMEDIATE RED ALERTS
  'انفجار', 'إطلاق', 'صواريخ', 'غارة جوية', 'اشتباكات', 'تسلل', 'اعتراض',
  // PRE-LAUNCH / LAUNCH DETECTION
  'إطلاق صواريخ', 'إطلاق باليستي', 'رصد إطلاق', 'تحميل منصات', 'جاهزية إطلاق',
  // LEADER STATEMENTS & DECLARATIONS
  'بيان', 'تصريح', 'خطاب', 'مؤتمر صحفي', 'أعلن', 'حذر', 'هدد',
  'خامنئي', 'بزشكيان', 'نصر الله', 'حسن نصرالله', 'السنوار', 'هنية',
  'الحرس الثوري', 'فيلق القدس', 'المرشد الأعلى',
  'تهديد مباشر', 'انتقام', 'رد', 'رد قاسي', 'ضربة انتقامية',
  // EMERGENCY & MEDICAL
  'حالة طوارئ', 'جرحى', 'قتلى', 'إصابات', 'خطيرة', 'إخلاء طبي', 'مروحية إنقاذ',
  'حادث متعدد الإصابات',
  // MILITARY MOVEMENTS
  'تحركات عسكرية', 'استنفار', 'تعزيزات', 'قافلة', 'حشد', 'آليات',
  // STRATEGIC WEAPONS
  'نووي', 'صواريخ باليستية', 'طائرة بدون طيار', 'مسيرة', 'غواصة',
  // INFRASTRUCTURE / CYBER
  'انقطاع التيار الكهربائي', 'هجوم سيبراني', 'تشويش', 'تعطل',
  // GEOPOLITICAL CHOKEPOINTS
  'مضيق هرمز', 'باب المندب', 'احتجاز سفينة', 'قناة السويس',
  // POLITICAL STABILITY
  'انقلاب', 'حالة الطوارئ', 'خطاب هام', 'مظاهرات', 'حظر تجول',
  // GLOBAL DYNAMICS / FINANCE
  'أسعار النفط', 'أزمة طاقة', 'سلاسل التوريد', 'تحالف استراتيجي', 'مجلس الأمن',
];

const RELEVANCE_KEYWORDS_EN = [
  // MILITARY / SECURITY
  'israel', 'iran', 'hezbollah', 'hamas', 'gaza', 'lebanon', 'syria', 'houthi',
  'yemen', 'missile', 'strike', 'attack', 'intercept', 'rocket', 'drone', 'uav',
  'idf', 'military', 'war', 'conflict', 'escalation', 'ceasefire', 'hostage',
  'terror', 'nuclear', 'ballistic', 'deploy', 'combat', 'killed', 'casualt',
  'defense', 'security', 'threat', 'patrol', 'naval', 'operation', 'airstrike',
  'middle east', 'west bank', 'netanyahu', 'tehran', 'beirut',
  // PRE-LAUNCH / LAUNCH DETECTION
  'launch detection', 'missile launch', 'ballistic launch', 'launch warning',
  'early warning', 'satellite detection', 'radar detection', 'missile loading',
  'launcher preparation', 'launch readiness', 'iron dome', 'arrow', 'david sling',
  'air defense', 'cruise missile', 'ground-to-ground',
  // LEADER STATEMENTS & DECLARATIONS
  'statement', 'declaration', 'speech', 'press conference', 'announced', 'warned', 'threatened',
  'khamenei', 'pezeshkian', 'nasrallah', 'sinwar', 'haniyeh',
  'irgc', 'quds force', 'supreme leader', 'revolutionary guard',
  'direct threat', 'retaliation', 'revenge', 'retaliatory strike', 'harsh response',
  'world leader', 'prime minister', 'president', 'defense minister', 'foreign minister',
  'macron', 'biden', 'trump', 'scholz', 'starmer', 'erdogan',
  // IMMEDIATE RED ALERTS
  'explosion', 'launch', 'air strike', 'interception', 'firefight', 'infiltration',
  'mass casualty', 'fatalities',
  // EMERGENCY & MEDICAL
  'emergency', 'casualties', 'wounded', 'medevac', 'rescue helicopter',
  'triage', 'field hospital',
  // MILITARY MOVEMENTS
  'troop movement', 'convoy', 'mobilization', 'high alert', 'deployment', 'armored vehicles',
  // STRATEGIC WEAPONS
  'enrichment', 's-400', 'hypersonic', 'aircraft carrier',
  // INFRASTRUCTURE / CYBER
  'blackout', 'cyber attack', 'gps jamming', 'infrastructure failure',
  // GEOPOLITICAL CHOKEPOINTS
  'strait of hormuz', 'bab el-mandeb', 'maritime seizure', 'suez canal',
  'taiwan strait', 'blockade',
  // POLITICAL STABILITY
  'coup', 'state of emergency', 'declaration of war', 'civil unrest', 'martial law',
  // GLOBAL DYNAMICS
  'supply chain', 'strategic alliance', 'un security council', 'sanctions',
  'energy crisis',
  // GULF STATES
  'emirates', 'uae', 'saudi', 'bahrain', 'qatar', 'abu dhabi', 'dubai', 'riyadh',
  'doha', 'manama', 'gcc', 'gulf', 'hormuz', 'opec',
  // RUSSIA & CHINA
  'russia', 'moscow', 'putin', 'kremlin', 'china', 'beijing', 'xi jinping',
  'russian', 'chinese', 'veto', 'un security', 'arms deal',
  // FINANCIAL / MARKETS
  'oil price', 'crude oil', 'brent', 'energy', 'shipping', 'trade route',
  'economy', 'market', 'stock', 'commodity', 'inflation', 'supply chain',
  'wall street', 'nasdaq', 'dow jones', 's&p 500', 'fed', 'interest rate',
  'central bank', 'bond', 'yield', 'forex', 'gold price', 'recession',
  'gdp', 'earnings', 'ipo', 'crypto', 'bitcoin', 'treasury', 'deficit',
  'tariff', 'trade war', 'currency', 'shekel', 'tel aviv stock',
];

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANCE_KEYWORDS_EN.some(kw => lower.includes(kw)) ||
    RELEVANCE_KEYWORDS_HE.some(kw => text.includes(kw)) ||
    RELEVANCE_KEYWORDS_AR.some(kw => text.includes(kw));
}

function classifySituation(text: string): { category: string; label: string } {
  const t = text.toLowerCase();
  // Military / Security
  if (/strike|attack|combat|intercept|missile|killed|casualt|war\b|airstrike|firefight|troop movement|convoy|mobilization|deployment|armored|תקיפה|יירוט|טיל|שיגור|נפילה|ירי|הפצצה|קרב|חילופי אש|סיכול|ריכוז כוחות|תנועת שיירות|גיוס מילואים|כוננות שיא|פריסת סוללות|הקפצה|شيירה|اشتباكات|تحركات عسكرية|استنفار|تعزيزات|قافلة/.test(t))
    return { category: 'military', label: 'ביטחוני' };
  // Home Front / Emergency
  if (/צבע אדום|חדירת כטב"ם|פגיעה ישירה|מרחב מוגן|אירוע רב נפגעים|מצב חירום|פינוי רפואי|מסוק חילוץ|תאג"ד|מד"א|mass casualty|medevac|rescue helicopter|triage|field hospital|حالة طوارئ|جرحى|إخلاء طبي|مروحية إنقاذ/.test(t))
    return { category: 'home_front', label: 'חירום' };
  // Strategic Weapons
  if (/nuclear|irgc|enrichment|centrifuge|ballistic|hypersonic|s-400|aircraft carrier|uav|drone|גרעין|העשרה|צנטריפוג|טילים בליסטיים|פרויקט הדיוק|כטב"ם|מל"ט מתאבד|צוללת|נושאת מטוסים|نووي|صواريخ باليستية|طائرة بدون طيار|مسيرة|غواصة/.test(t))
    return { category: 'strategic_weapons', label: 'נשק אסטרטגי' };
  // Cyber / Infrastructure
  if (/cyber|blackout|gps jamming|infrastructure failure|סייבר|האקר|לוחמת סייבר|מתקפת מנע|שיבושי gps|קריסת רשת|הפסקת חשמל|ניתוק|חושך|هجوم سيبراني|تشويش|تعطل|انقطاع التيار/.test(t))
    return { category: 'cyber', label: 'סייבר-תשתיות' };
  // Geopolitical Chokepoints
  if (/hormuz|bab el-mandeb|maritime seizure|suez canal|taiwan strait|blockade|הורמוז|באב אל מנדב|חסימה|תפיסת ספינה|תעלת סואץ|מיצר טאיוואן|مضيق هرمز|باب المندب|احتجاز سفينة|قناة السويس/.test(t))
    return { category: 'chokepoints', label: 'נקודות חנק ימיות' };
  // Political Stability
  if (/coup|state of emergency|declaration of war|civil unrest|martial law|הפיכה|מרד|הכרזת מלחמה|סגר|עוצר|חוסר יציבות|انقلاب|حالة الطوارئ|خطاب هام|مظاهرات|حظر تجول/.test(t))
    return { category: 'political_stability', label: 'יציבות פוליטית' };
  // Diplomacy
  if (/diplom|agreement|summit|sanction|negotiat|ceasefire|treaty|הסכם|דיפלומט|סנקצי|משא ומתן|הפסקת אש/.test(t))
    return { category: 'diplomatic', label: 'מדיני' };
  // Terrorism
  if (/terror|stabbing|ramming|shooting|infiltration|פיגוע|דקירה|חדירה|מנהרה|تسلل/.test(t))
    return { category: 'terrorism', label: 'טרור' };
  // Finance / Macro
  if (/oil price|crude|brent|opec|economy|market|stock|trade|shipping|supply chain|inflation|commodity|recession|gdp|wall street|nasdaq|interest rate|energy crisis|נפט|כלכל|מסחר|שוק|בורסה|דולר|ריבית|אינפלציה|נאסד"ק|מחירי הנפט|משבר אנרגיה|שרשרת אספקה|أسعار النفط|أزمة طاقة|سلاسل التوريد/.test(t))
    return { category: 'economic', label: 'כלכלי' };
  // Global Dynamics
  if (/strategic alliance|un security council|veto|multipolar|hegemony|ברית אסטרטגית|וטו|מועצת הביטחון|סחר חוץ|تحالف استراتيجي|مجلس الأمن/.test(t))
    return { category: 'global_dynamics', label: 'דינמיקה גלובלית' };
  // Internal Politics
  if (/election|parliament|government|coalition|opposition|כנסת|ממשלה|קואליצי|אופוזיצי|בחירות/.test(t))
    return { category: 'political', label: 'מדיני-פנים' };
  // Humanitarian
  if (/humanitarian|refugee|evacuate|hospital|aid|פליטים|סיוע|פינוי|בית חולים|הומניטרי/.test(t))
    return { category: 'humanitarian', label: 'הומניטרי' };
  return { category: 'general', label: 'כללי' };
}

function extractSeverity(text: string): string {
  const lower = text.toLowerCase();
  // Critical — immediate threats, casualties, attacks
  if (/breaking|urgent|strike|attack|killed|casualt|intercept|war\b|explosion|mass casualty|fatalities|firefight|מבזק|דחוף|תקיפה|הרוגים|פצועים|יירוט|שיגור|נפילה|פיצוץ|חילופי אש|סיכול|חדירת כטב"ם|פגיעה ישירה|אירוע רב נפגעים|טיפול תחת אש|انفجار|إطلاق|صواريخ|غارة جوية|اشتباكات|قتلى|إصابات خطيرة/.test(lower)) return 'critical';
  // High — escalation, strategic weapons, military movements
  if (/deploy|escalat|threat|warning|alert|nuclear|ballistic|hypersonic|mobilization|troop movement|הסלמה|איום|כוננות|גרעין|טילים בליסטיים|צנטריפוגות|ריכוז כוחות|גיוס מילואים|כוננות שיא|פריסת סוללות|מל"ט מתאבד|نووي|صواريخ باليستية|تحركات عسكرية|استنفار|تعزيزات/.test(lower)) return 'high';
  // Warning — infrastructure, chokepoints, stability
  if (/exercise|readiness|patrol|drill|blackout|cyber|coup|state of emergency|blockade|תרגיל|סיור|הפסקת חשמל|לוחמת סייבר|שיבושי gps|הפיכה|מרד|הכרזת מלחמה|מיצרי הורמוז|חסימה|مضيق هرمز|انقلاب|هجوم سيبراني|حظر تجول/.test(lower)) return 'warning';
  // Medium — diplomatic, economic, geopolitical
  if (/meeting|summit|visit|cooperation|sanction|oil price|recession|inflation|ביקור|פגישה|שיתוף|סנקציות|הסכם|בורסה|نفט|أسعار النفط/.test(lower)) return 'medium';
  return 'low';
}

// Parse RSS XML
function parseRss(xml: string): { title: string; summary: string; date: string; link: string }[] {
  const results: { title: string; summary: string; date: string; link: string }[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const item = match[1];
    const title = (/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(item))?.[1]?.trim() || '';
    const desc = (/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(item))?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || '';
    const date = (/<pubDate>([^<]+)<\/pubDate>/i.exec(item))?.[1]?.trim() || '';
    const link = (/<link>([^<]+)<\/link>/i.exec(item))?.[1]?.trim() || '';
    if (title && title.length > 5) {
      results.push({ title, summary: desc, date, link });
    }
  }
  return results;
}

// Parse HTML headlines (generic)
function parseHeadlines(html: string): { title: string; link: string }[] {
  const results: { title: string; link: string }[] = [];
  // Various patterns for headlines
  const patterns = [
    /<h[1-4][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{10,})<\/a>/gi,
    /<a[^>]*href="([^"]*)"[^>]*class="[^"]*(?:title|headline|article)[^"]*"[^>]*>([^<]{10,})<\/a>/gi,
    /<a[^>]*href="([^"]*)"[^>]*>\s*<(?:h[1-4]|span|strong)[^>]*>([^<]{10,})<\//gi,
  ];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const title = m[2].replace(/\s+/g, ' ').trim();
      if (!seen.has(title) && title.length > 10 && !/cookie|privacy|login|subscribe|newsletter/i.test(title)) {
        seen.add(title);
        results.push({ title, link: m[1] });
      }
    }
  }
  return results;
}

// Normalize text for deduplication
function normalizeForDedup(text: string): string {
  return text
    .replace(/\[.*?\]\s*/g, '')      // Remove [SOURCE] prefixes
    .replace(/[\s\-_.,!?:;()\[\]{}#@'"]/g, '')
    .replace(/\d/g, '')
    .slice(0, 40)
    .toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const allItems: any[] = [];
    const globalDedup = new Set<string>();

    // ── Fetch from all sources in parallel ──
    const fetchPromises = NEWS_FEEDS.map(async (feed) => {
      const feedItems: any[] = [];

      // Try RSS first
      if (feed.rss) {
        try {
          const resp = await fetch(feed.rss, {
            headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const xml = await resp.text();
            const items = parseRss(xml);
            console.log(`${feed.nameEn} RSS: ${items.length} items`);
            for (const item of items.slice(0, 15)) {
              const fullText = `${item.title} ${item.summary}`;
              if (isRelevant(fullText)) {
                const situation = classifySituation(fullText);
                feedItems.push({
                  source: `news_${feed.id}`,
                  category: situation.category,
                  title: `[${feed.nameEn}] ${item.title}`,
                  summary: item.summary || item.title,
                  severity: extractSeverity(fullText),
                  region: feed.id.startsWith('ch') || feed.id === 'ch11' ? 'ישראל' : 'Global',
                  tags: [feed.id, situation.label, 'news', 'flash'],
                  raw_data: {
                    source_name: feed.nameEn,
                    source_id: feed.id,
                    icon: feed.icon,
                    color: feed.color,
                    url: item.link,
                    date: item.date,
                    situation: situation.label,
                  },
                });
              }
            }
          }
        } catch (err) {
          console.warn(`${feed.nameEn} RSS error:`, err);
        }
      }

      // HTML fallback if RSS got nothing
      if (feedItems.length === 0) {
        for (const url of feed.urls.slice(0, 1)) {
          try {
            const resp = await fetch(url, {
              headers: { 'User-Agent': UA, 'Accept': 'text/html' },
              signal: AbortSignal.timeout(8000),
            });
            if (resp.ok) {
              const html = await resp.text();
              const headlines = parseHeadlines(html);
              console.log(`${feed.nameEn} HTML: ${headlines.length} headlines`);
              for (const hl of headlines.slice(0, 10)) {
                if (isRelevant(hl.title)) {
                  const situation = classifySituation(hl.title);
                  feedItems.push({
                    source: `news_${feed.id}`,
                    category: situation.category,
                    title: `[${feed.nameEn}] ${hl.title}`,
                    summary: hl.title,
                    severity: extractSeverity(hl.title),
                    region: feed.id.startsWith('ch') || feed.id === 'ch11' ? 'ישראל' : 'Global',
                    tags: [feed.id, situation.label, 'news', 'flash'],
                    raw_data: {
                      source_name: feed.nameEn,
                      source_id: feed.id,
                      icon: feed.icon,
                      color: feed.color,
                      url: hl.link,
                      situation: situation.label,
                    },
                  });
                }
              }
            }
          } catch (err) {
            console.warn(`${feed.nameEn} HTML error:`, err);
          }
        }
      }

      return feedItems;
    });

    const results = await Promise.all(fetchPromises);
    
    // Merge & deduplicate across all sources
    for (const feedItems of results) {
      for (const item of feedItems) {
        const dedupKey = normalizeForDedup(item.title);
        if (!globalDedup.has(dedupKey)) {
          globalDedup.add(dedupKey);
          allItems.push(item);
        }
      }
    }

    console.log(`Total unique news items: ${allItems.length}`);

    // ── Dedup against DB (last 6 hours) ──
    const since = new Date(Date.now() - 21600000).toISOString();
    const { data: existing } = await supabase
      .from('intel_reports')
      .select('title')
      .gte('created_at', since)
      .like('source', 'news_%')
      .limit(500);

    const existingNormalized = new Set((existing || []).map(r => normalizeForDedup(r.title)));

    let stored = 0;
    for (const item of allItems) {
      const normalizedTitle = normalizeForDedup(item.title);
      if (existingNormalized.has(normalizedTitle)) continue;
      const { error } = await supabase.from('intel_reports').insert(item);
      if (!error) stored++;
      else console.error('Insert error:', error.message);
    }

    // ── Smart situation analysis ──
    const situationAnalysis = {
      security: allItems.filter(i => i.category === 'military' || i.category === 'terrorism').length,
      diplomatic: allItems.filter(i => i.category === 'diplomatic' || i.category === 'political').length,
      nuclear: allItems.filter(i => i.category === 'nuclear').length,
      humanitarian: allItems.filter(i => i.category === 'humanitarian').length,
      criticalCount: allItems.filter(i => i.severity === 'critical').length,
      highCount: allItems.filter(i => i.severity === 'high').length,
    };

    // Generate situation summary if significant
    if (situationAnalysis.criticalCount > 2) {
      const summaryTitle = `⚡ ניתוח מצב: ${situationAnalysis.criticalCount} מבזקים קריטיים מ-${new Set(allItems.map(i => i.raw_data?.source_id)).size} מקורות`;
      if (!existingNormalized.has(normalizeForDedup(summaryTitle))) {
        await supabase.from('intel_reports').insert({
          source: 'news_analysis',
          category: 'military',
          title: summaryTitle,
          summary: `ניתוח חכם: ${situationAnalysis.security} דיווחים ביטחוניים, ${situationAnalysis.diplomatic} מדיניים, ${situationAnalysis.humanitarian} הומניטריים. ${allItems.filter(i => i.severity === 'critical').map(i => i.title).slice(0, 3).join(' | ')}`,
          severity: 'critical',
          region: 'ישראל / מזה"ת',
          tags: ['analysis', 'situation', 'auto'],
          raw_data: { situationAnalysis, itemCount: allItems.length },
        });
      }
    }

    // ── Return latest from all news sources ──
    const { data: latestNews } = await supabase
      .from('intel_reports')
      .select('*')
      .like('source', 'news_%')
      .order('created_at', { ascending: false })
      .limit(80);

    return new Response(JSON.stringify({
      ok: true,
      scraped: allItems.length,
      stored,
      bySource: NEWS_FEEDS.map(f => ({
        id: f.id,
        name: f.nameEn,
        count: allItems.filter(i => i.source === `news_${f.id}`).length,
      })),
      situationAnalysis,
      news: latestNews || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('News flash error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
