const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleChat } = require('./plugins/auto_chat');

// ==========================================
// 1. HTTP Server for UptimeRobot (Port 3000)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('البوت شغال 100% 🟢');
});

app.listen(PORT, () => {
    console.log(`[SERVER] HTTP Server running on port ${PORT} for UptimeRobot.`);
});

// ==========================================
// 2. WhatsApp Client Initialization
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Rate Limiting Map
const rateLimits = new Map();

client.on('qr', (qr) => {
    console.log('[QR CODE] قم بمسح الكود التالي لربط الواتساب:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('[WHATSAPP] تم الاتصال بنجاح! البوت الآن جاهز للعمل.');
});

client.on('message', async (msg) => {
    try {
        // تجاهل رسائل الجروبات ورسائل البوت نفسه
        if (msg.fromMe || msg.isGroupMsg) return;

        const userId = msg.from;
        const now = Date.now();

        // ==========================================
        // 3. Rate Limiting (3 Seconds)
        // ==========================================
        if (rateLimits.has(userId)) {
            const lastMessageTime = rateLimits.get(userId);
            if (now - lastMessageTime < 3000) {
                console.log(`[RATE LIMIT] تم تجاهل رسالة من ${userId} (أقل من 3 ثوانٍ)`);
                return; 
            }
        }
        rateLimits.set(userId, now);

        // توجيه الرسالة إلى ملف auto_chat.js
        await handleChat(client, msg);

    } catch (error) {
        console.error('[ERROR] حدث خطأ في معالجة الرسالة الأساسية:', error);
    }
});

client.initialize();
