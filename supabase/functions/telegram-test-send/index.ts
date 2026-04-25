import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface BotDef {
  name: string;
  useGateway: boolean;
  envKey: string;
}

const BOTS: BotDef[] = [
  { name: 'warroom_control', useGateway: true, envKey: 'TELEGRAM_API_KEY' },
  { name: 'red_bot', useGateway: false, envKey: 'TELEGRAM_RED_BOT_TOKEN' },
  { name: 'blue_bot', useGateway: false, envKey: 'TELEGRAM_BLUE_BOT_TOKEN' },
];

async function callTelegram(bot: BotDef, method: string, body: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  let resp: Response;

  if (bot.useGateway) {
    const apiKey = Deno.env.get(bot.envKey)!;
    resp = await fetch(`${GATEWAY_URL}/${method}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } else {
    const token = Deno.env.get(bot.envKey)!;
    resp = await fetch(`${TELEGRAM_API_BASE}${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const results: Record<string, any> = {};

  for (const bot of BOTS) {
    const key = Deno.env.get(bot.envKey);
    if (!key) {
      results[bot.name] = { error: `Missing ${bot.envKey}` };
      continue;
    }

    try {
      // Get bot info
      const me = await callTelegram(bot, 'getMe', {});
      
      // Get recent updates
      const updates = await callTelegram(bot, 'getUpdates', {
        offset: -3, limit: 3, timeout: 0,
      });

      results[bot.name] = {
        botInfo: me.result ? { username: me.result.username, id: me.result.id } : me,
        recentUpdates: updates.result?.length ?? 0,
        status: me.ok ? '✅ connected' : '❌ error',
      };
    } catch (err) {
      results[bot.name] = { error: String(err) };
    }
  }

  return new Response(JSON.stringify({ bots: results, timestamp: new Date().toISOString() }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
