import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const MAX_RUNTIME_MS = 50_000;
const MIN_REMAINING_MS = 5_000;
const LOCK_WINDOW_MS = 45_000;
const PER_BOT_RUNTIME_MS = 10_000;
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

type BotMode = 'direct' | 'gateway';

interface BotConfig {
  stateId: number;
  botName: string;
  mode: BotMode;
  envKey: string;
}

const BOT_CONFIGS: BotConfig[] = [
  { stateId: 101, botName: 'warroom_control', mode: 'gateway', envKey: 'TELEGRAM_API_KEY' },
  { stateId: 102, botName: 'red_bot', mode: 'direct', envKey: 'TELEGRAM_RED_BOT_TOKEN' },
  { stateId: 103, botName: 'blue_bot', mode: 'direct', envKey: 'TELEGRAM_BLUE_BOT_TOKEN' },
  { stateId: 104, botName: 'gold_bot', mode: 'direct', envKey: 'TELEGRAM_GOLD_BOT_TOKEN' },
];

// ── Severity detection ──
const SEV_CRITICAL = /צבע אדום|אזעקה|ירי רקטות|חדירה|חדירת כטב"ם|פגיעה ישירה|פיגוע|טיל שיוט|חלל|נפילה|חילופי אש|סיכול|אירוע רב נפגעים|אר"ן|הרוגים|קשה ואנוש|התרעה|כניסה למרחב מוגן|מסר אישי|זיהוי שיגור|שיגור מאיראן|שיגור בליסטי|התרעת שיגור|יירוט בליסטי|انفجار|إطلاق|صواريخ|غارة جوية|اشتباكات|تسلل|اعتراض|قتلى|إصابات خطيرة|Explosion|Launch detection|Missile launch|Ballistic launch|Air strike|Interception|Firefight|Infiltration|Mass casualty|Fatalities/i;
const SEV_HIGH = /שיגור|כוננות|תקיפה|הסלמה|פיצוץ|ירי|ריכוז כוחות|גיוס מילואים|כוננות שיא|פריסת סוללות|טילים בליסטיים|כטב"ם|מל"ט מתאבד|גרעין|מצב חירום|פצועים|נפגעים|פינוי רפואי|כוננות שיגור|העברת טילים|טעינת משגרים|גילוי מוקדם|איום ישיר|גמול|נקמה|מתקפת תגמול|חמינאי|נסראללה|משמרות המהפכה|IRGC|MEDEVAC|تحركات عسكرية|استنفار|نووي|صواريخ باليستية|طائرة بدون طيار|جرحى|إخلاء طبي|حالة طوارئ|تهديد مباشر|انتقام|خامنئي|نصر الله|الحرس الثوري|Troop movement|Mobilization|Nuclear|Ballistic|UAV|Drone|Casualties|Khamenei|Nasrallah|Retaliation/i;
const SEV_WARNING = /חשד|תנועה חריגה|ניטור|אזהרה|מעקב|הפסקת חשמל|לוחמת סייבר|הפיכה|מרד|הכרזת מלחמה|מצב חירום|סגר|עוצר|מיצרי הורמוז|באב אל מנדב|חסימה|תעלת סואץ|הצהרה|נאום|הודעה רשמית|מסיבת עיתונאים|הזהיר|איים|انقطاع التيار|هجوم سيبراني|انقلاب|حالة الطوارئ|مضيق هرمز|باب المندب|قناة السويس|بيان|خطاب|أعلن|حذر|هدد|Blackout|Cyber attack|Coup|State of emergency|Strait of Hormuz|Bab el-Mandeb|Suez Canal|Statement|Declaration|Warned|Threatened/i;
const SEV_MEDIUM = /דיווח|עדכון|הודעה|מידע|מחירי הנפט|סנקציות|איראן|הבית הלבן|טראמפ|ביידן|הסכם|מודיעין|נפט|דולר|ריבית|אינפלציה|בורסה|נאסד"ק|נתניהו|Oil prices|Sanctions|UN Security Council|Prime minister|President/i;

function detectSeverity(text: string): string {
  if (!text) return 'low';
  if (SEV_CRITICAL.test(text)) return 'critical';
  if (SEV_HIGH.test(text)) return 'high';
  if (SEV_WARNING.test(text)) return 'warning';
  if (SEV_MEDIUM.test(text)) return 'medium';
  return 'low';
}

const TAG_KEYWORDS: [string, string][] = [
  ['חיזבאללה', 'חיזבאללה'], ['חמאס', 'חמאס'], ['איראן', 'איראן'], ['נאט"ו', 'נאטו'],
  ['רקטות', 'רקטות'], ['צבע אדום', 'אזעקות'], ['אזעקה', 'אזעקות'], ['נפילה', 'נפילות'], ['יירוט', 'יירוטים'],
  ['גבול', 'גבול'], ['צפון', 'צפון'], ['עזה', 'עזה'], ['דרום', 'דרום'], ['לבנון', 'לבנון'], ['סוריה', 'סוריה'],
  ['כטב"ם', 'כטבם'], ['מל"ט', 'כטבם'], ['UAV', 'כטבם'], ['Drone', 'כטבם'],
  ['גרעין', 'גרעין'], ['Nuclear', 'גרעין'], ['نووي', 'גרעין'],
  ['ירי', 'ירי'], ['פיצוץ', 'פיצוצים'], ['מילואים', 'מילואים'],
  ['סייבר', 'סייבר'], ['Cyber', 'סייבר'], ['הורמוז', 'הורמוז'], ['Hormuz', 'הורמוז'],
  ['הפיכה', 'חוסר_יציבות'], ['Coup', 'חוסר_יציבות'],
  ['נפט', 'נפט'], ['דולר', 'כלכלה'], ['ריבית', 'כלכלה'], ['בורסה', 'כלכלה'],
  ['פצועים', 'חירום_רפואי'], ['הרוגים', 'חירום_רפואי'],
  ['זיהוי שיגור', 'זיהוי_שיגור'], ['שיגור בליסטי', 'שיגור_בליסטי'],
  ['כיפת ברזל', 'הגנה_אווירית'], ['Iron Dome', 'הגנה_אווירית'],
  ['חמינאי', 'מנהיגי_איראן'], ['Khamenei', 'מנהיגי_איראן'],
  ['נסראללה', 'חיזבאללה'], ['Nasrallah', 'חיזבאללה'],
  ['נתניהו', 'ממשלת_ישראל'], ['הרמטכ"ל', 'ממשלת_ישראל'],
  ['IRGC', 'IRGC'], ['משמרות המהפכה', 'IRGC'],
  ['סנקציות', 'סנקציות'], ['Sanctions', 'סנקציות'],
  ['מצב חירום', 'חירום'], ['State of emergency', 'חירום'],
];

function extractTags(text: string): string[] {
  if (!text) return [];
  const tags = new Set<string>();
  for (const [kw, tag] of TAG_KEYWORDS) {
    if (text.includes(kw)) tags.add(tag);
    if (tags.size >= 10) break;
  }
  return [...tags];
}

function hashText(text: string): string {
  const norm = text.replace(/[\u{1F600}-\u{1F9FF}]/gu, '').replace(/[""״׳']/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (norm.length < 5) return '';
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) | 0;
  return h.toString(36);
}

async function ensureBotState(supabase: ReturnType<typeof createClient>, bot: BotConfig) {
  const { data: existing, error: existingError } = await supabase
    .from('telegram_bot_state')
    .select('id, update_offset, updated_at')
    .eq('id', bot.stateId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from('telegram_bot_state')
    .upsert({
      id: bot.stateId,
      bot_name: bot.botName,
      update_offset: 0,
      updated_at: new Date(0).toISOString(),
    }, { onConflict: 'id' })
    .select('id, update_offset, updated_at')
    .single();

  if (insertError) throw insertError;
  return inserted;
}

async function fetchBotUpdates(bot: BotConfig, requestBody: Record<string, unknown>) {
  if (bot.mode === 'gateway') {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionApiKey = Deno.env.get(bot.envKey);
    if (!lovableApiKey || !connectionApiKey) {
      return { ok: false, status: 500, text: async () => `Missing ${!lovableApiKey ? 'LOVABLE_API_KEY' : bot.envKey}` } as Response;
    }

    return fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': connectionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000),
    });
  }

  const botToken = Deno.env.get(bot.envKey);
  if (!botToken) {
    return { ok: false, status: 500, text: async () => `Missing ${bot.envKey}` } as Response;
  }

  return fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10000),
  });
}

async function pollSingleBot(
  supabase: ReturnType<typeof createClient>,
  bot: BotConfig,
  globalDeadline: number,
  hashIndex: Map<string, string>,
) {
  const state = await ensureBotState(supabase, bot);
  const lastRun = state.updated_at ? new Date(state.updated_at).getTime() : 0;
  const now = Date.now();

  if (now - lastRun < LOCK_WINDOW_MS) {
    return { bot: bot.botName, skipped: true, processed: 0, reason: 'Another instance ran recently' };
  }

  const lockIso = new Date().toISOString();
  const { data: lockedRows, error: lockError } = await supabase
    .from('telegram_bot_state')
    .update({ bot_name: bot.botName, updated_at: lockIso })
    .eq('id', bot.stateId)
    .eq('updated_at', state.updated_at)
    .select('id');

  if (lockError || !lockedRows || lockedRows.length === 0) {
    return { bot: bot.botName, skipped: true, processed: 0, reason: 'Lock contention' };
  }

  let currentOffset = state.update_offset;
  let processed = 0;
  let emptyPolls = 0;
  const botDeadline = Math.min(globalDeadline, Date.now() + PER_BOT_RUNTIME_MS);

  while (Date.now() < botDeadline) {
    const response = await fetchBotUpdates(bot, {
      offset: currentOffset,
      timeout: 0,
      limit: 100,
      allowed_updates: ['message', 'channel_post'],
    }).catch((fetchError) => {
      console.error(`[${bot.botName}] Fetch error:`, fetchError);
      return null;
    });

    if (!response) break;

    if (!response.ok) {
      if (response.status === 409) {
        console.log(`[${bot.botName}] 409 conflict — another getUpdates is already active`);
        return { bot: bot.botName, skipped: true, processed, reason: '409 conflict' };
      }

      const errText = await response.text();
      console.error(`[${bot.botName}] Error ${response.status}:`, errText.slice(0, 300));
      return { bot: bot.botName, skipped: false, processed, reason: `HTTP ${response.status}` };
    }

    const payload = await response.json();
    const updates = payload.result ?? [];

    if (updates.length === 0) {
      emptyPolls++;
      if (emptyPolls >= 2) break;
      continue;
    }

    emptyPolls = 0;

    const rows: Array<Record<string, unknown>> = [];
    const groupUpdates = new Map<number, { title: string; type: string; lastMessageAt: string | null }>();
    const localHashes = new Map<string, string>();

    for (const update of updates) {
      const msg = update.message || update.channel_post;
      if (!msg) continue;

      const chatId = msg.chat.id;
      const msgText = (msg.text || msg.caption || '').trim();
      const messageDate = typeof msg.date === 'number' ? new Date(msg.date * 1000).toISOString() : null;

      if (msg.chat.type !== 'private') {
        groupUpdates.set(chatId, {
          title: msg.chat.title || `Chat ${chatId}`,
          type: msg.chat.type || 'group',
          lastMessageAt: messageDate,
        });
      }

      if (!msgText || msgText.length < 3) continue;

      const rowId = crypto.randomUUID();
      const contentHash = hashText(msgText) || null;
      const persistedDuplicateId = contentHash ? hashIndex.get(contentHash) ?? null : null;
      const localDuplicateId = contentHash ? localHashes.get(contentHash) ?? null : null;
      const duplicateOf = persistedDuplicateId;
      const isDuplicate = Boolean(persistedDuplicateId || localDuplicateId);

      const senderName = msg.from
        ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
        : msg.sender_chat?.title || 'Unknown';

      rows.push({
        id: rowId,
        update_id: update.update_id,
        chat_id: chatId,
        message_id: msg.message_id,
        sender_name: senderName,
        text: msgText,
        message_date: messageDate,
        content_hash: contentHash,
        is_duplicate: isDuplicate,
        duplicate_of: duplicateOf,
        severity: detectSeverity(msgText),
        tags: extractTags(msgText),
        raw_update: update,
        bot_name: bot.botName,
      });

      if (contentHash && !localHashes.has(contentHash)) {
        localHashes.set(contentHash, rowId);
      }
    }

    if (rows.length > 0) {
      const updateIds = rows.map((row) => row.update_id as number);
      const { data: existingRows, error: existingError } = await supabase
        .from('telegram_messages')
        .select('update_id')
        .in('update_id', updateIds);

      if (existingError) {
        console.error(`[${bot.botName}] Existing rows query error:`, existingError);
        return { bot: bot.botName, skipped: false, processed, reason: existingError.message };
      }

      const existingSet = new Set((existingRows || []).map((row) => row.update_id));
      const rowsToInsert = rows.filter((row) => !existingSet.has(row.update_id as number));

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('telegram_messages')
          .insert(rowsToInsert);

        if (insertError) {
          console.error(`[${bot.botName}] Insert error:`, insertError);
          return { bot: bot.botName, skipped: false, processed, reason: insertError.message };
        }

        processed += rowsToInsert.length;

        rowsToInsert.forEach((row) => {
          const contentHash = row.content_hash;
          const isDuplicate = row.is_duplicate;
          if (typeof contentHash === 'string' && contentHash && !isDuplicate) {
            hashIndex.set(contentHash, row.id as string);
          }
        });
      }
    }

    for (const [chatId, info] of groupUpdates.entries()) {
      const { error: groupError } = await supabase
        .from('telegram_groups')
        .upsert({
          chat_id: chatId,
          title: info.title,
          type: info.type,
          last_message_at: info.lastMessageAt,
        }, { onConflict: 'chat_id' });

      if (groupError) {
        console.error(`[${bot.botName}] Group upsert error:`, groupError);
      }
    }

    const newOffset = Math.max(...updates.map((update: { update_id: number }) => update.update_id)) + 1;
    const { error: offsetError } = await supabase
      .from('telegram_bot_state')
      .upsert({
        id: bot.stateId,
        bot_name: bot.botName,
        update_offset: newOffset,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (offsetError) {
      console.error(`[${bot.botName}] Offset update error:`, offsetError);
      return { bot: bot.botName, skipped: false, processed, reason: offsetError.message };
    }

    currentOffset = newOffset;
  }

  return { bot: bot.botName, skipped: false, processed, finalOffset: currentOffset };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startTime = Date.now();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Pre-load recent hashes for dedup
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: recentHashes } = await supabase
    .from('telegram_messages')
    .select('id, content_hash')
    .gte('created_at', oneHourAgo)
    .eq('is_duplicate', false)
    .not('content_hash', 'is', null)
    .limit(500);

  const hashIndex = new Map<string, string>();
  (recentHashes || []).forEach(r => { if (r.content_hash) hashIndex.set(r.content_hash, r.id); });

  const enabledBots = BOT_CONFIGS.filter((bot) => Boolean(Deno.env.get(bot.envKey)));
  if (enabledBots.length === 0) {
    return new Response(JSON.stringify({ error: 'No Telegram bot credentials configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const deadline = startTime + MAX_RUNTIME_MS - MIN_REMAINING_MS;
  const botResults = [];
  let totalProcessed = 0;

  for (const bot of enabledBots) {
    if (Date.now() >= deadline) break;
    const result = await pollSingleBot(supabase, bot, deadline, hashIndex);
    botResults.push(result);
    totalProcessed += result.processed || 0;
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, bots: botResults, runtime: Date.now() - startTime }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
