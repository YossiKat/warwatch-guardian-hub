#!/usr/bin/env node
/**
 * EWS Telegram User Client
 * קורא הודעות מכל קבוצה שאתה חבר בה
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
const http = require('http');

require('dotenv').config();

const API_ID = parseInt(process.env.TG_API_ID);
const API_HASH = process.env.TG_API_HASH;
const PHONE = process.env.TG_PHONE;
const SESSION_FILE = './tg_session.txt';
const MESSAGES_FILE = './tg_messages.json';

// Load existing session
let sessionStr = '';
if (fs.existsSync(SESSION_FILE)) {
  sessionStr = fs.readFileSync(SESSION_FILE, 'utf8').trim();
  console.log('✅ Session loaded');
}

const client = new TelegramClient(
  new StringSession(sessionStr),
  API_ID,
  API_HASH,
  { connectionRetries: 5 }
);

// Messages store
let messages = [];

async function main() {
  console.log('🔗 מתחבר לטלגרם...');
  
  await client.start({
    phoneNumber: async () => PHONE,
    password: async () => await input.text('סיסמת 2FA (אם יש): '),
    phoneCode: async () => await input.text('קוד מ-Telegram: '),
    onError: (err) => console.log('שגיאה:', err),
  });

  // Save session
  const session = client.session.save();
  fs.writeFileSync(SESSION_FILE, session);
  console.log('✅ מחובר! Session נשמר.');

  // Get all dialogs
  const dialogs = await client.getDialogs({ limit: 100 });
  console.log(`📡 ${dialogs.length} קבוצות/קנאלים`);

  // Listen for new messages
  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg || !msg.text) return;

    const chat = await msg.getChat();
    const chatName = chat.title || chat.firstName || chat.username || '?';
    
    const msgObj = {
      id: `tgu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      chatName,
      chatId: chat.id?.toString(),
      text: msg.text,
      timestamp: Date.now(),
      severity: getSeverity(msg.text),
      heat: getHeat(msg.text),
      hasImpact: /נפל|פגיעה|חבול|הרוג|ירי|פיצוץ/i.test(msg.text),
      hasRescue: /הצלה|מד.א|פינוי|נפגע/i.test(msg.text),
      source: 'telegram_user',
    };

    messages.unshift(msgObj);
    if (messages.length > 200) messages = messages.slice(0, 200);
    
    // Save to file
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages));
    console.log(`💬 [${chatName}]: ${msg.text.slice(0, 60)}`);
  });

  // Start HTTP server on port 3001
  http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(messages));
  }).listen(3001, () => {
    console.log('✅ TG User API → http://localhost:3001');
    console.log('✅ מאזין לכל הקבוצות שלך...');
  });

  // Keep alive
  await new Promise(() => {});
}

function getSeverity(text) {
  if (/אזעקה|ירי|טיל|פגיעה|הרוג|חמאס|חיזבאללה/i.test(text)) return 'critical';
  if (/נפגע|כוחות|תקרית|ביטחוני/i.test(text)) return 'high';
  if (/עצור|תאונה|שריפה/i.test(text)) return 'medium';
  return 'low';
}

function getHeat(text) {
  if (getSeverity(text) === 'critical') return 3;
  if (getSeverity(text) === 'high') return 2;
  return 1;
}

main().catch(console.error);
