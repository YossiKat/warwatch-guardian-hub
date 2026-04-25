#!/bin/bash
# ════════════════════════════════════════════════════
# חיבור Lovable לשרת המקומי שלך
# ════════════════════════════════════════════════════
DIR="$HOME/Desktop/ews"
SERVER="https://oxidizing-walmart-mortality.ngrok-free.dev"

cd "$DIR"

echo "🔗 מחבר Lovable לשרת..."

# 1. עדכן useTelegram.ts
cat > src/hooks/useTelegram.ts << 'EOF'
import { useState, useEffect } from 'react';

const getServer = () => localStorage.getItem('ews_server_url') || 'https://oxidizing-walmart-mortality.ngrok-free.dev';

interface TelegramMessage {
  id: string;
  chatName: string;
  text: string;
  timestamp: number;
  hasImpact: boolean;
  hasRescue: boolean;
  severity: string;
  heat: number;
}

export function useTelegram() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const resp = await fetch(`${getServer()}/api/tg-messages`, {
          headers: { 'ngrok-skip-browser-warning': '1' }
        });
        if (!resp.ok) throw new Error('Server error');
        const data = await resp.json();
        const msgs = Array.isArray(data) ? data : (data.messages || []);
        setMessages(msgs.slice(0, 50));
        setMessageCount(msgs.length);
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };
    fetchMessages();
    const iv = setInterval(fetchMessages, 8000);
    return () => clearInterval(iv);
  }, []);

  return { messages, isConnected, messageCount };
}
EOF
echo "✅ useTelegram.ts"

# 2. עדכן useWarRoom.ts
cat > src/hooks/useWarRoom.ts << 'EOF'
import { useState, useEffect } from 'react';

const getServer = () => localStorage.getItem('ews_server_url') || 'https://oxidizing-walmart-mortality.ngrok-free.dev';

export function useWarRoom() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tgMessages, setTgMessages] = useState<any[]>([]);
  const [orefActive, setOrefActive] = useState(false);
  const [orefAreas, setOrefAreas] = useState<string[]>([]);
  const [aiLevel, setAiLevel] = useState(3);
  const [aiStatus, setAiStatus] = useState('מערכת פעילה');
  const [rssCount, setRssCount] = useState(0);
  const [botsStatus, setBotsStatus] = useState<any[]>([]);

  useEffect(() => {
    const H = { 'ngrok-skip-browser-warning': '1' };
    const S = getServer();

    const fetchAll = async () => {
      try {
        // RSS Alerts
        const r1 = await fetch(`${S}/api/alerts`, { headers: H });
        if (r1.ok) {
          const d = await r1.json();
          setAlerts(Array.isArray(d) ? d.slice(0, 30) : []);
          setRssCount(Array.isArray(d) ? d.length : 0);
        }
      } catch {}

      try {
        // TG Messages
        const r2 = await fetch(`${S}/api/tg-messages`, { headers: H });
        if (r2.ok) {
          const d = await r2.json();
          const msgs = Array.isArray(d) ? d : (d.messages || []);
          setTgMessages(msgs.slice(0, 20));
        }
      } catch {}

      try {
        // Status + OREF + AI
        const r3 = await fetch(`${S}/api/status`, { headers: H });
        if (r3.ok) {
          const d = await r3.json();
          setOrefActive(!!d.orefActive);
          setOrefAreas(d.orefAreas || []);
          setAiLevel(d.readinessLevel || 3);
          setAiStatus(d.aiStatus || 'כוננות 3/5');
        }
      } catch {}

      try {
        // Bots
        const r4 = await fetch(`${S}/api/bots`, { headers: H });
        if (r4.ok) {
          const d = await r4.json();
          setBotsStatus(d.bots || []);
        }
      } catch {}
    };

    fetchAll();
    const iv = setInterval(fetchAll, 8000);
    return () => clearInterval(iv);
  }, []);

  return { alerts, tgMessages, orefActive, orefAreas, aiLevel, aiStatus, rssCount, botsStatus };
}
EOF
echo "✅ useWarRoom.ts"

# 3. Push to GitHub → Lovable rebuilds
git add -A
git commit -m "Connect Lovable to local EWS server via ngrok"
git push
echo "✅ GitHub updated — Lovable יתעדכן תוך 2 דקות"
echo ""
echo "🌐 Lovable: https://https-late-geese-train-loca-lt.lovable.app"
