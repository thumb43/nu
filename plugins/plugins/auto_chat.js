const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const STORE_PATH = path.resolve(__dirname, "../data/chat_sessions.json");

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    }
  } catch {}
  return {};
}

function saveStore(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("فشل حفظ الجلسات:", e.message);
  }
}

const sessionStore = loadStore();
const TWO_HOURS = 2 * 60 * 60 * 1000;
const MAX_HISTORY = 10;
const RATE_LIMIT_MS = 3000;
const lastRequestTime = {};

const SYSTEM_PROMPT = `
أنت "صديقك الرقمي"، مساعد عبر واتساب.

[هويتك الصارمة]:
- تحدث دائماً كإنسان مغربي حقيقي بالدارجة المغربية اللطيفة والمرحة.
- استخدم الإيموجي بشكل طبيعي وغير مبالغ فيه.
- لا تذكر أبداً أنك ذكاء اصطناعي أو روبوت أو نموذج لغوي.
- إذا سألك أحد قل فقط: أنا صديقك الرقمي 😄
- كن اجتماعياً، افتح مواضيع جانبية، واسأل عن أحوال الشخص.

[خدماتك]:
📥 تحميل الفيديوهات من يوتيوب وتيك توك وإنستغرام وفيسبوك
🎵 تحميل الموسيقى باسم الأغنية أو رابط مباشر
🎨 تحويل الصور إلى ستيكرز واتساب
🎮 ألعاب وتحديات ذكاء
🧠 الإجابة على أي سؤال

[أسلوب الرد]:
- جمل قصيرة وطبيعية كأنك تكتب على هاتفك
- تجنب الردود الطويلة ما لم يطلب المستخدم شرحاً
- إذا أرسل رابطاً اسأله عن نوع التحميل
- إذا أرسل صوت أو فيديو اعرض عليه خيارات التحويل
`;

const SERVICES_LIST = `
🌟 مرحباً بيك من جديد! أنا هنا دائماً 😄
إيلا كنت محتاج شي حاجة هاهي خدماتي:

📥 *تحميل الفيديوهات* — ابعثلي رابط من يوتيوب أو تيك توك أو إنستغرام
🎵 *تحميل الموسيقى* — اسم الأغنية أو رابط مباشر
🎨 *صناعة ستيكرز* — ابعثلي أي صورة وسأحولها لملصق 🔥
🎮 *ألعاب وذكاء* — اكتب games للبدء 😏
🧠 *ذكاء اصطناعي* — أي سؤال عندك فقط اسألني

واش فيه شي خدمتك اليوم؟ 👇
`;

function isRateLimited(sender) {
  const now = Date.now();
  if (lastRequestTime[sender] && now - lastRequestTime[sender] < RATE_LIMIT_MS) {
    return true;
  }
  lastRequestTime[sender] = now;
  return false;
}

module.exports = {
  name: "auto_chat",
  async run(conn, mek, m, { text, from, sender, isMedia, mtype }) {
    const userText = text?.trim();
    if (!userText && !isMedia) return;

    if (isRateLimited(sender)) {
      return await conn.sendMessage(
        from,
        { text: "عاود بعد ثانية 😄" },
        { quoted: mek }
      );
    }

    if (!sessionStore[sender]) {
      sessionStore[sender] = { lastTime: 0, history: [] };
    }

    const session = sessionStore[sender];
    const now = Date.now();
    const showServices = session.lastTime === 0 || now - session.lastTime > TWO_HOURS;
    session.lastTime = now;

    let inputText = userText;
    if (isMedia) {
      const mediaType =
        mtype === "audioMessage" ? "مقطع صوتي" :
        mtype === "videoMessage" ? "مقطع فيديو" : "ملف وسائط";
      inputText = `[أرسل المستخدم ${mediaType}] ${userText || ""}`;
    }

    if (!inputText) return;

    try {
      const systemInstruction = showServices
        ? `${SYSTEM_PROMPT}\n\n[تعليمات]: ابدأ ردك بهذا النص:\n${SERVICES_LIST}`
        : SYSTEM_PROMPT;

      const history = (session.history || [])
        .slice(-MAX_HISTORY)
        .map(h => ({ role: h.role, parts: [{ text: h.text }] }));

      const chat = model.startChat({
        systemInstruction,
        history,
        generationConfig: { maxOutputTokens: 512, temperature: 0.85 },
      });

      const result = await chat.sendMessage(inputText);
      const response = result.response.text().trim();
      if (!response) throw new Error("رد فارغ");

      session.history.push(
        { role: "user", text: inputText },
        { role: "model", text: response }
      );
      if (session.history.length > MAX_HISTORY * 2) {
        session.history = session.history.slice(-MAX_HISTORY * 2);
      }
      saveStore(sessionStore);

      await conn.sendMessage(from, { text: response }, { quoted: mek });

    } catch (error) {
      console.error("خطأ:", error.message);
      const msg = error.message?.includes("quota")
        ? "سمح ليا عندي شوية ضغط دابا 🙏"
        : "كاين شي مشكل صغير عاود صيفط ليا 😅";
      await conn.sendMessage(from, { text: msg }, { quoted: mek });
    }
  },
};
