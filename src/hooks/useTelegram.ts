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
