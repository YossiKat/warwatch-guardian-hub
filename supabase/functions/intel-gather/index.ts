import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

// Intelligence gathering using Lovable AI + open news sources
const NEWS_SOURCES = [
  { url: 'https://www.ynet.co.il/news/category/184', name: 'Ynet Security' },
  { url: 'https://www.kan.org.il/lobby/defense/', name: 'Kan Defense' },
  { url: 'https://www.timesofisrael.com/topic/israel-security/', name: 'TOI Security' },
];

// Telegram channels known for security/defense news (public channels)
const TELEGRAM_NEWS_CHANNELS = [
  '@tzaborr',        // צופר - Tzofar alerts
  '@red_alert_israel', // Red Alert
  '@israeldefense',  // Israel Defense
  '@yabornet',       // יאבורנט
  '@kann_news',      // כאן חדשות
  '@news_0404',      // חדשות 0404
  '@mabornet',       // מבורנט ביטחון
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Gather Telegram messages from DB for analysis
    const { data: recentMessages } = await supabase
      .from('telegram_messages')
      .select('*')
      .eq('is_duplicate', false)
      .order('created_at', { ascending: false })
      .limit(100);

    // 2. Gather Oref alerts
    const { data: recentAlerts } = await supabase
      .from('oref_alerts')
      .select('*')
      .order('alert_date', { ascending: false })
      .limit(50);

    // 3. Analyze patterns in Telegram messages
    const messages = recentMessages || [];
    const alerts = recentAlerts || [];

    // Deduplication analysis
    const contentHashes = new Map<string, any[]>();
    for (const msg of messages) {
      if (msg.content_hash) {
        if (!contentHashes.has(msg.content_hash)) {
          contentHashes.set(msg.content_hash, []);
        }
        contentHashes.get(msg.content_hash)!.push(msg);
      }
    }

    // Mark duplicates that weren't caught before
    const newDuplicates: string[] = [];
    for (const [hash, msgs] of contentHashes.entries()) {
      if (msgs.length > 1) {
        // Keep first, mark rest as duplicates
        const original = msgs[0];
        for (let i = 1; i < msgs.length; i++) {
          if (!msgs[i].is_duplicate) {
            newDuplicates.push(msgs[i].id);
            await supabase
              .from('telegram_messages')
              .update({ is_duplicate: true, duplicate_of: original.id })
              .eq('id', msgs[i].id);
          }
        }
      }
    }

    // 4. Generate intelligence categories from messages
    const intelReports: any[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Category analysis
    const categories: Record<string, { count: number; messages: any[]; severity: string }> = {
      'military': { count: 0, messages: [], severity: 'medium' },
      'home_front': { count: 0, messages: [], severity: 'medium' },
      'launch_detection': { count: 0, messages: [], severity: 'critical' },
      'leader_statements': { count: 0, messages: [], severity: 'medium' },
      'geopolitical': { count: 0, messages: [], severity: 'low' },
      'diplomatic': { count: 0, messages: [], severity: 'low' },
      'humanitarian': { count: 0, messages: [], severity: 'low' },
      'cyber': { count: 0, messages: [], severity: 'low' },
      'terrorism': { count: 0, messages: [], severity: 'medium' },
      'strategic_weapons': { count: 0, messages: [], severity: 'medium' },
      'infrastructure': { count: 0, messages: [], severity: 'low' },
      'chokepoints': { count: 0, messages: [], severity: 'low' },
      'political_stability': { count: 0, messages: [], severity: 'low' },
      'finance': { count: 0, messages: [], severity: 'low' },
      'global_dynamics': { count: 0, messages: [], severity: 'low' },
    };

    // launch_detection requires COMPOUND phrases only — no single generic words
    // that also appear in routine military/home_front reports
    const categoryKeywords: Record<string, string[]> = {
      'launch_detection': [
        // Confirmed strategic launch phrases ONLY — Hebrew
        'שיגור מאיראן', 'שיגור מתימן', 'שיגור מעיראק', 'שיגור מלבנון לעומק',
        'שיגור בליסטי לעבר ישראל', 'מטח טילים בליסטיים', 'מטח מאיראן',
        'טעינת משגרים', 'העמסת משגרים', 'הכנת משגרים', 'כוננות שיגור',
        'התראה לפני שיגור', 'גילוי מוקדם של שיגור',
        'שיגור טילים בליסטיים', 'שיגור טילי שיוט',
        'שיגור קרקע-קרקע', 'שיגור מרובה לעבר',
        // Arabic — specific compound phrases
        'إطلاق باليستي نحو إسرائيل', 'إطلاق صاروخي من إيران',
        'تحميل منصات الإطلاق', 'جاهزية إطلاق استراتيجي',
        // English — specific compound phrases
        'Ballistic launch toward Israel', 'Launch detected from Iran',
        'Launch detected from Yemen', 'Launch detected from Iraq',
        'TEL loading confirmed', 'Pre-launch activity detected',
        'ICBM launch', 'Strategic launch warning',
      ],
      'leader_statements': [
        // LEADER STATEMENTS & DECLARATIONS — Hebrew
        'הצהרה', 'הצהרת', 'נאום', 'הודעה רשמית', 'מסיבת עיתונאים', 'הכריז', 'הזהיר', 'איים',
        'חמינאי', 'פזשכיאן', 'נסראללה', 'נסרללה', 'סינוואר', 'הנייה',
        'ראש ממשלה', 'נתניהו', 'שר הביטחון', 'הרמטכ"ל', 'דובר צה"ל',
        'מנהיג עליון', 'משמרות המהפכה', 'חיל קודס', 'IRGC',
        'איום ישיר', 'גמול', 'נקמה', 'תגובה', 'מתקפת תגמול', 'תגובה קשה',
        // Arabic
        'بيان', 'تصريح', 'خطاب', 'مؤتمر صحفي', 'أعلن', 'حذر', 'هدد',
        'خامنئي', 'بزشكيان', 'نصر الله', 'حسن نصرالله', 'السنوار', 'هنية',
        'الحرس الثوري', 'فيلق القدس', 'المرشد الأعلى',
        'تهديد مباشر', 'انتقام', 'رد', 'رد قاسي', 'ضربة انتقامية',
        // English
        'Statement', 'Declaration', 'Speech', 'Press conference', 'Announced', 'Warned', 'Threatened',
        'Khamenei', 'Pezeshkian', 'Nasrallah', 'Sinwar', 'Haniyeh',
        'Supreme leader', 'Revolutionary guard', 'Quds force',
        'Direct threat', 'Retaliation', 'Revenge', 'Retaliatory strike', 'Harsh response',
        'World leader', 'Prime minister', 'President', 'Defense minister', 'Foreign minister',
        'Macron', 'Biden', 'Trump', 'Scholz', 'Starmer', 'Erdogan',
      ],
      'military': [
        'צבא', 'צה"ל', 'חיל', 'כוחות', 'שיגור', 'ירי', 'תקיפה', 'הפצצה', 'טיל', 'רקטה',
        'חיזבאללה', 'חמאס', 'סוללה', 'מילואים', 'ריכוז כוחות', 'תנועת שיירות', 'גיוס מילואים',
        'כוננות שיא', 'פריסת סוללות', 'הקפצה', 'שיירה', 'מובילים', 'חילופי אש', 'סיכול',
        'تحركات عسكرية', 'استنفار', 'تعزيزات', 'قافلة', 'حشد', 'آليات', 'اشتباكات',
        'Troop movement', 'Convoy', 'Mobilization', 'High alert', 'Deployment', 'Armored vehicles',
      ],
      'home_front': [
        'צבע אדום', 'חדירת כטב"ם', 'פגיעה ישירה', 'יירוט', 'התרעה', 'כניסה למרחב מוגן', 'מסר אישי',
        'שחרור', 'חזרה לשגרה', 'הנחיות', 'סיום אירוע', 'דיווח ראשוני',
      ],
      'geopolitical': [
        'איראן', 'סוריה', 'לבנון', 'ירדן', 'מצרים', 'תורכיה', 'רוסיה', 'סין', 'ארה"ב', 'או"ם', 'נאט"ו',
        'הבית הלבן', 'טראמפ', 'ביידן', 'מודיעין',
      ],
      'diplomatic': [
        'שגריר', 'ממשלה', 'ראש ממשלה', 'נשיא', 'שר', 'הסכם', 'משא ומתן', 'סנקציות', 'דיפלומטיה',
        'Sanctions', 'Strategic alliance',
      ],
      'humanitarian': [
        'פליטים', 'סיוע', 'פינוי', 'אזרחים', 'נפגעים', 'הרוגים', 'פצועים', 'בית חולים', 'מקלט', 'חלל',
      ],
      'cyber': [
        'סייבר', 'האקר', 'מתקפת סייבר', 'פריצה', 'תשתיות', 'לוחמת סייבר', 'מתקפת מנע',
        'שיבושי GPS', 'ניתוק', 'קריסת רשת', 'הפסקת חשמל', 'חושך',
        'هجوم سيبراني', 'تشويش', 'تعطل', 'انقطاع التيار',
        'Cyber attack', 'GPS jamming', 'Blackout', 'Infrastructure failure',
      ],
      'terrorism': [
        'פיגוע', 'חדירה', 'מנהרה', 'חטיפה', 'מחבל', 'דקירה', 'ירי', 'تسلل',
        'Infiltration', 'Firefight',
      ],
      'strategic_weapons': [
        'גרעין', 'טילים בליסטיים', 'צנטריפוגות', 'פרויקט הדיוק', 'כטב"ם', 'מל"ט מתאבד',
        'צוללת', 'נושאת מטוסים', 'כטב',
        'نووي', 'صواريخ باليستية', 'طائرة بدون طيار', 'مسيرة', 'غواصة',
        'Nuclear', 'Ballistic', 'UAV', 'Drone', 'Enrichment', 'S-400', 'Hypersonic', 'Aircraft carrier',
      ],
      'chokepoints': [
        'מיצרי הורמוז', 'באב אל מנדב', 'חסימה', 'תפיסת ספינה', 'נתיבי שיט', 'תעלת סואץ', 'מיצר טאיוואן',
        'مضيق هرمز', 'باب المندب', 'احتجاز سفينة', 'قناة السويس',
        'Strait of Hormuz', 'Bab el-Mandeb', 'Maritime seizure', 'Suez Canal', 'Taiwan Strait', 'Blockade',
      ],
      'political_stability': [
        'הפיכה', 'מרד', 'הכרזת מלחמה', 'נאום דרמטי', 'מצב חירום', 'סגר', 'עוצר', 'חוסר יציבות',
        'انقلاب', 'حالة الطوارئ', 'خطاب هام', 'مظاهرات', 'حظر تجول',
        'Coup', 'State of emergency', 'Declaration of war', 'Civil unrest', 'Martial law',
      ],
      'finance': [
        'נפט', 'דולר', 'ריבית', 'אינפלציה', 'בורסה', 'נאסד"ק',
        'מחירי הנפט', 'משבר אנרגיה', 'שרשרת אספקה',
        'أسعار النفط', 'أزمة طاقة',
        'Oil prices', 'Energy crisis',
      ],
      'global_dynamics': [
        'סחר חוץ', 'נתיבי שיט', 'ברית אסטרטגית',
        'וטו', 'מועצת הביטחון',
        'سلاسل التوريد', 'تحالف استراتيجي', 'مجلس الأمن',
        'Supply chain', 'Strategic alliance', 'UN Security Council',
        'Sanctions', 'Hegemony', 'Multipolar world',
      ],
    };

    for (const msg of messages) {
      if (!msg.text) continue;
      const msgTime = new Date(msg.message_date || msg.created_at);
      const isRecent = msgTime > oneHourAgo;

      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => msg.text.includes(kw))) {
          categories[cat].count++;
          if (isRecent) {
            categories[cat].messages.push(msg);
          }
          // Upgrade severity based on Telegram severity
          if (msg.severity === 'critical') categories[cat].severity = 'critical';
          else if (msg.severity === 'high' && categories[cat].severity !== 'critical') categories[cat].severity = 'high';
          else if (msg.severity === 'warning' && !['critical', 'high'].includes(categories[cat].severity)) categories[cat].severity = 'warning';
        }
      }
    }

    // 5. Generate alert-based intelligence
    if (alerts.length > 0) {
      const recentAlertCount = alerts.filter(a => 
        new Date(a.alert_date) > oneHourAgo
      ).length;

      const locations = new Set<string>();
      for (const a of alerts.slice(0, 20)) {
        for (const loc of (a.locations || [])) {
          locations.add(loc);
        }
      }

      if (recentAlertCount > 0) {
        intelReports.push({
          source: 'oref_analysis',
          category: 'military',
          title: `${recentAlertCount} התרעות פיקוד העורף בשעה האחרונה`,
          summary: `אזורים מושפעים: ${[...locations].slice(0, 10).join(', ')}. סה"כ ${alerts.length} התרעות במאגר.`,
          severity: recentAlertCount > 10 ? 'critical' : recentAlertCount > 5 ? 'high' : 'warning',
          region: [...locations].slice(0, 3).join(', '),
          tags: ['oref', 'alerts', 'realtime'],
          raw_data: { alertCount: recentAlertCount, locations: [...locations].slice(0, 20) },
        });
      }
    }

    // 6. Generate category intelligence summaries
    for (const [cat, data] of Object.entries(categories)) {
      if (data.count === 0) continue;

      const categoryNames: Record<string, string> = {
        'launch_detection': '🚨 זיהוי שיגור / התרעה מוקדמת',
        'leader_statements': '📢 הצהרות מנהיגים / איומים',
        'military': 'צבאי-ביטחוני',
        'home_front': 'פיקוד העורף',
        'geopolitical': 'גיאופוליטי',
        'diplomatic': 'דיפלומטי',
        'humanitarian': 'הומניטרי',
        'cyber': 'סייבר-תשתיות',
        'terrorism': 'טרור',
        'strategic_weapons': 'נשק אסטרטגי',
        'chokepoints': 'נקודות חנק ימיות',
        'political_stability': 'יציבות פוליטית',
        'finance': 'כלכלי / מאקרו',
        'global_dynamics': 'דינמיקה גלובלית',
      };

      const recentTexts = data.messages
        .slice(0, 5)
        .map(m => m.text?.slice(0, 100))
        .filter(Boolean);

      intelReports.push({
        source: 'telegram_analysis',
        category: cat,
        title: `ניתוח ${categoryNames[cat]}: ${data.count} דיווחים`,
        summary: recentTexts.length > 0
          ? `דיווחים אחרונים: ${recentTexts.join(' | ')}`
          : `${data.count} הודעות בקטגוריה זו נאספו מטלגרם`,
        severity: data.severity,
        region: null,
        tags: [cat, 'telegram', 'analysis'],
        raw_data: { messageCount: data.count, recentCount: data.messages.length },
      });
    }

    // 7. Cross-source correlation
    if (messages.length > 0 && alerts.length > 0) {
      // Check if Telegram reports correlate with Oref alerts
      const alertLocations = new Set(alerts.flatMap(a => a.locations || []));
      const telegramLocations = new Set<string>();
      
      const locationKeywords = ['תל אביב', 'חיפה', 'ירושלים', 'באר שבע', 'אשדוד', 'אשקלון', 'שדרות', 'צפת', 'נהריה', 'אילת'];
      for (const msg of messages) {
        if (!msg.text) continue;
        for (const loc of locationKeywords) {
          if (msg.text.includes(loc)) telegramLocations.add(loc);
        }
      }

      const overlap = [...alertLocations].filter(l => telegramLocations.has(l));
      if (overlap.length > 0) {
        intelReports.push({
          source: 'cross_correlation',
          category: 'military',
          title: `קורלציה: ${overlap.length} מיקומים מאומתים ממקורות מרובים`,
          summary: `מיקומים שמדווחים גם בפיקוד העורף וגם בטלגרם: ${overlap.join(', ')}`,
          severity: 'high',
          region: overlap.join(', '),
          tags: ['correlation', 'verified', 'multi-source'],
          raw_data: { overlapping: overlap },
        });
      }
    }

    // 8. Store reports (avoid duplicates by checking recent)
    let stored = 0;
    const { data: existingRecent } = await supabase
      .from('intel_reports')
      .select('title')
      .gte('created_at', new Date(now.getTime() - 600000).toISOString()) // 10 min
      .limit(100);

    const existingTitles = new Set((existingRecent || []).map(r => r.title));

    for (const report of intelReports) {
      if (existingTitles.has(report.title)) continue;
      const { error } = await supabase.from('intel_reports').insert(report);
      if (!error) stored++;
    }

    // Return latest reports
    const { data: latestReports } = await supabase
      .from('intel_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    return new Response(JSON.stringify({
      ok: true,
      analyzed: messages.length,
      duplicatesFound: newDuplicates.length,
      reportsGenerated: intelReports.length,
      stored,
      reports: latestReports || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Intel error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
