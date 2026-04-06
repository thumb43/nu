const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const CONFIG = {
    TG_TOKEN: process.env.TG_TOKEN,
    ADMIN_ID: 8294538151,
    GEMINI_KEY: process.env.GEMINI_KEY
};

const bot = new Telegraf(CONFIG.TG_TOKEN);

async function fetchTikTokTrend() {
    try {
        const res = await axios.get('https://www.tikwm.com/api/feed/list?region=SA&count=1');
        return res.data.data[0];
    } catch (e) { return null; }
}

async function generateCaption(title) {
    try {
        const aiRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_KEY}`, {
            contents: [{ parts: [{ text: `اكتب وصفاً جذاباً جداً لتيك توك عن فيديو موضوعه: ${title}. أضف أقوى 5 هاشتاقات للانتشار.` }] }]
        });
        return aiRes.data.candidates[0].content.parts[0].text;
    } catch (e) { return "فيديو رائع اليوم! #ترند #تيك_توك"; }
}

bot.command('hunt', async (ctx) => {
    if (ctx.from.id !== CONFIG.ADMIN_ID) return;
    ctx.reply("🔎 جاري صيد فيديو ترند جديد...");
    
    const video = await fetchTikTokTrend();
    if (!video) return ctx.reply("❌ لم أجد فيديوهات حالياً.");

    const caption = await generateCaption(video.title || "Trending Video");
    
    // تصحيح الرابط هنا: التأكد من عدم تكرار النطاق
    let videoUrl = video.play;
    if (!videoUrl.startsWith('http')) {
        videoUrl = `https://www.tikwm.com${videoUrl}`;
    }

    try {
        await ctx.replyWithVideo(videoUrl, {
            caption: `🔥 **تم الصيد!**\n\n📝 **الوصف:**\n${caption}`,
            ...Markup.inlineKeyboard([
                [Markup.button.url('📥 رابط الفيديو', videoUrl)],
                [Markup.button.callback('🔄 صيد آخر', 'hunt_again')]
            ])
        });
    } catch (error) {
        ctx.reply("⚠️ عذراً، حدث خطأ في إرسال الفيديو. جرب مرة أخرى.");
        console.log("Error details:", error.message);
    }
});

bot.action('hunt_again', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("🔎 جاري البحث عن فيديو آخر...");
    // يمكنك استدعاء دالة الصيد هنا
});

bot.launch();
console.log("✅ البوت يعمل وجاهز للصيد...");
