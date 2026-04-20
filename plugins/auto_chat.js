const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// إعداد Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: {
        parts: [{ 
            text: "أنت صديق رقمي تتحدث بالدارجة المغربية فقط. أسلوبك مرح، فكاهي، وودود كإنسان حقيقي. لا تذكر أبداً أنك ذكاء اصطناعي أو روبوت أو لغة نموذجية. إذا سألك أحد عن هويتك، قل دائماً 'أنا صديقك الرقمي'. استخدم الإيموجي بشكل طبيعي وتفاعل بأسلوب مغربي شعبي ومحترم." 
        }]
    }
});

// مسار ملف حفظ البيانات
const DATA_FILE = path.join(__dirname, '..', 'users_data.json');

// دوال مساعدة لقراءة وكتابة ملف JSON
async function loadUserData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // إذا لم يكن الملف موجوداً، أرجع كائن فارغ
    }
}

async function saveUserData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[ERROR] خطأ في حفظ بيانات المستخدم:', error);
    }
}

// الدالة الرئيسية لمعالجة الرسائل
async function handleChat(client, msg) {
    const userId = msg.from;
    const usersData = await loadUserData();
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // إنشاء ملف للمستخدم إذا كان يراسلنا لأول مرة
    if (!usersData[userId]) {
        usersData[userId] = {
            lastMessageTime: 0,
            history: []
        };
    }

    const userData = usersData[userId];
    const timeSinceLastMessage = now - userData.lastMessageTime;
    
    // تحديث وقت آخر رسالة
    userData.lastMessageTime = now;

    // ==========================================
    // 1. معالجة الوسائط (الصوتيات والفيديوهات)
    // ==========================================
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        if (media && (media.mimetype.startsWith('audio/') || media.mimetype.startsWith('video/'))) {
            await msg.reply("شفتك صيفطتي ليا أوديو ولا فيديو! 🎬 واش بغيتي نحولو ليك لشي صيغة أخرى؟ (هادي ميزة غنزيدها قريباً 😉)");
            await saveUserData(usersData);
            return;
        }
    }

    // ==========================================
    // 2. منطق الساعتين (الترحيب وقائمة الخدمات)
    // ==========================================
    if (timeSinceLastMessage > TWO_HOURS_MS) {
        const welcomeMessage = `🌟 مرحباً بيك هاهي خدماتي:\n\n📥 تحميل الفيديوهات يوتيوب وتيك توك وإنستغرام\n🎵 تحميل الموسيقى\n🎨 صناعة الستيكرز\n🎮 ألعاب وتحديات\n🧠 الإجابة على أي سؤال`;
        await msg.reply(welcomeMessage);
        
        // تفريغ السياق القديم بعد مرور ساعتين لبدء محادثة جديدة ونظيفة
        userData.history = [];
        await saveUserData(usersData);
        return;
    }

    // ==========================================
    // 3. الدردشة الطبيعية مع الذكاء الاصطناعي
    // ==========================================
    try {
        // إعداد سياق المحادثة لنموذج Gemini
        const chatHistory = userData.history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));

        const chat = model.startChat({
            history: chatHistory
        });

        // إرسال رسالة المستخدم للذكاء الاصطناعي (إذا أرسل صورة فقط بدون نص، نعوضها بـ "صورة")
        const userText = msg.body || (msg.hasMedia ? "صيفطت ليك تصويرة" : "سلام");
        const result = await chat.sendMessage(userText);
        const responseText = result.response.text();

        // الرد على المستخدم
        await msg.reply(responseText);

        // ==========================================
        // 4. تحديث سياق المحادثة (حفظ آخر 10 رسائل)
        // ==========================================
        userData.history.push({ role: 'user', text: userText });
        userData.history.push({ role: 'model', text: responseText });

        // الرسالة الواحدة تتكون من طلب ورد (2)، لذا للحفاظ على 10 رسائل نحتفظ بآخر 20 عنصر
        if (userData.history.length > 20) {
            userData.history = userData.history.slice(-20);
        }

        await saveUserData(usersData);

    } catch (error) {
        console.error('[GEMINI ERROR] حدث خطأ في الذكاء الاصطناعي:', error);
        await msg.reply("سمح ليا أخويا/ختي، كاين شي مشكل تقني دابا، عاود صيفط ليا من بعد شوية. 😅");
    }
}

module.exports = { handleChat };
