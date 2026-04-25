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
