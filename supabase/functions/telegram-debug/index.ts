const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

Deno.serve(async () => {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

  const headers = {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': TELEGRAM_API_KEY,
    'Content-Type': 'application/json',
  };

  // 1. Check webhook
  const whResp = await fetch(`${GATEWAY_URL}/getWebhookInfo`, { method: 'POST', headers });
  const whData = await whResp.json();

  // 2. Get bot info
  const meResp = await fetch(`${GATEWAY_URL}/getMe`, { method: 'POST', headers });
  const meData = await meResp.json();

  // 3. Try getUpdates with offset 0 to see if there's anything at all
  const updResp = await fetch(`${GATEWAY_URL}/getUpdates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ offset: -1, limit: 1, timeout: 0 }),
  });
  const updData = await updResp.json();

  // 4. If webhook is set, delete it
  let deleteResult = null;
  if (whData.result?.url) {
    const delResp = await fetch(`${GATEWAY_URL}/deleteWebhook`, { method: 'POST', headers });
    deleteResult = await delResp.json();
  }

  return new Response(JSON.stringify({
    webhook: whData,
    bot: meData,
    latestUpdate: updData,
    webhookDeleted: deleteResult,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
