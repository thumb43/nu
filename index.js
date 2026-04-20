const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");
const autoChatPlugin = require("./plugins/auto_chat");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ["WhatsApp Bot", "Chrome", "1.0.0"],
  });

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) console.log("امسح الـ QR Code بواتساب ديالك 👆");

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
      console.log("✅ البوت شغال!");
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
