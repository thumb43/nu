const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");
const autoChatPlugin = require("./plugins/auto_chat");
const readline = require("readline");

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["WhatsApp Bot", "Chrome", "1.0.0"],
  });

  // طلب Pairing Code
  if (!state.creds.registered) {
    const phoneNumber = await question("حط رقم هاتفك بالصيغة الدولية (مثال: 212XXXXXXXXX): ");
    const code = await conn.requestPairingCode(phoneNumber.trim());
    console.log(`\n✅ كود الربط ديالك هو: ${code}\n`);
    console.log("مشي لواتساب ← الأجهزة المرتبطة ← ربط جهاز ← ربط برقم الهاتف\n");
  }

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log("إعادة الاتصال...");
        startBot();
      } else {
        console.log("تم تسجيل الخروج — امسح auth_info وأعد التشغيل");
      }
    }
    if (connection === "open") {
      console.log("✅ البوت شغال ومتصل!");
    }
  });

  conn.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const mek = messages[0];
    if (!mek?.message || mek.key.fromMe) return;

    const from = mek.key.remoteJid;
    const sender = mek.key.participant || from;
    const mtype = Object.keys(mek.message)[0];
    const text =
      mek.message?.conversation ||
      mek.message?.extendedTextMessage?.text ||
      mek.message?.imageMessage?.caption ||
      mek.message?.videoMessage?.caption ||
      "";
    const isMedia = ["audioMessage", "videoMessage", "imageMessage"].includes(mtype);

    try {
      await autoChatPlugin.run(conn, mek, mek, {
        text, from, sender, isMedia, mtype,
      });
    } catch (err) {
      console.error("خطأ:", err.message);
    }
  });
}

startBot();
