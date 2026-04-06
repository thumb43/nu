const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const CONFIG = {
    TG_TOKEN: '8287483651:AAHddP3gfysIWarMb7YFujAFvzykO01q0q4', // التوكن الجديد
    ADMIN_ID: 8294538151,
    GEMINI_KEY: 'AIzaSyCKB5PwFvzlhvVFRISGC11qSQkGJbr3nJY'
};

const bot = new Telegraf(CONFIG.TG_TOKEN);

// دالة لجلب الفيديوهات الرائجة (Trend)
async function fetchTikTokTrend() {
    try {
        // نستخدم API وسيطة لجلب الترند (مثال باستخدام TikWM)
        const res = await axios.get('https://www.tikwm.com/api/feed/list?region=SA&count=1');
        return res.data.data[0]; 
    } catch (e) {
        console.error("خطأ في جلب الترند:", e);
        return null;
    }
}

// دالة لتوليد الهاشتاقات والوصف بالذكاء الاصطناعي
async function generateCaption(title) {
    try {
        const aiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_KEY}`, {
            contents: [{ parts: [{ text: `اكتب وصفاً جذاباً جداً لتيك توك عن فيديو موضوعه: ${title}. أضف أقوى 5 هاشتاقات للانتشار.` }] }]
        });
        return aiRes.data.candidates[0].content.parts[0].text;
    } catch (e) {
        return "فيديو رائع! #ترند #تيك_توك";
    }
}

bot.command('hunt', async (ctx) => {
    if (ctx.from.id !== CONFIG.ADMIN_ID) return;
    
    ctx.reply("🕵️ جاري صيد أقوى فيديو ترند حالياً...");
    
    const video = await fetchTikTokTrend();
    if (!video) return ctx.reply("❌ لم أستطع العثور على فيديوهات جديدة حالياً.");

    const caption = await generateCaption(video.title || "فيديو رائج");
    const videoNoWatermark = `https://www.tikwm.com${video.play}`;

    await ctx.replyWithVideo(videoNoWatermark, {
        caption: `🔥 **تم صيد ترند جديد!**\n\n📝 **الوصف المقترح:**\n${caption}`,
        ...Markup.inlineKeyboard([
            [Markup.button.url('📥 رابط التحميل المباشر', videoNoWatermark)],
            [Markup.button.callback('🔎 صيد فيديو آخر', 'hunt_again')]
        ])
    });
});

bot.action('hunt_again', (ctx) => ctx.answerCbQuery() && bot.handleUpdate({ message: { text: '/hunt', from: ctx.from }, update_id: 0 }));

bot.launch();
console.log("🚀 بوت صيد الترندات يعمل.. أرسل /hunt في تلجرام.");

