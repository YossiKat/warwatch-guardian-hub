const { Telegraf } = require('telegraf');
const express = require('express'), app = express(), http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: '*' } });
const bot = new Telegraf('8651250652:AAHkLc4yu3prS7bkNbFb4D57YtjUtdMpFPw');

app.use(express.static('public'));

bot.on('message', (ctx) => {
    const text = ctx.message.text || ctx.message.caption || '';
    const from = ctx.chat.title || 'DIRECT';
    
    // שליחת מידע רזה בלבד למניעת קריסה
    io.emit('intel_event', { 
        src: from, 
        text: text.substring(0, 200), // מגביל אורך טקסט
        time: new Date().toLocaleTimeString('he-IL') 
    });
});

bot.telegram.deleteWebhook({ drop_pending_updates: true }).then(() => bot.launch());
http.listen(3001, '0.0.0.0');
console.log('🚀 ENGINE READY - LIGHTWEIGHT MODE');
