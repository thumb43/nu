import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import yt_dlp
import os
from flask import Flask
from threading import Thread

# --- إعدادات السيرفر لإبقاء البوت حياً ---
app = Flask('')

@app.route('/')
def home():
    return "The Luxury Downloader Bot is Running 24/7!"

def run():
    app.run(host='0.0.0.0', port=8080)

def keep_alive():
    t = Thread(target=run)
    t.start()

# --- إعدادات البوت والقناة (الحماية من التسريب) ---
# ملاحظة: قم بوضع التوكن في إعدادات الاستضافة (Render) تحت اسم BOT_TOKEN
TOKEN = os.environ.get('BOT_TOKEN') 
CHANNEL_USERNAME = '@zsewwi'
bot = telebot.TeleBot(TOKEN)

# قاموس اللغات والنصوص
TEXTS = {
    'ar': {
        'force_join': "تمهل عزيزي! ✋\nيجب عليك الانضمام أولاً إلى قناتنا لتتمكن من استخدام البوت الاستثنائي الخاص بنا.",
        'join_btn': "انضم إلى القناة من هنا 📥",
        'check_btn': "تم الانضمام ✅",
        'send_link': "مرحباً بك في البوت الأسطوري! 🚀\nالمرجو إرسال رابط الفيديو الذي تريد تحميله من أي موقع (إنستغرام، تيك توك، يوتيوب...):",
        'downloading': "جاري معالجة الرابط وتحميل الفيديو بأفضل جودة... ⏳\nالرجاء الانتظار قليلاً.",
        'error': "عذراً، حدث خطأ! تأكد من الرابط أو أن حجم الفيديو لا يتجاوز 50MB.",
        'not_joined': "عذراً عزيزي، لم تنضم بعد! انضم واضغط على التاكيد."
    },
    'en': {
        'force_join': "Hold on dear! ✋\nYou must join our channel first to use our premium bot.",
        'join_btn': "Join Channel 📥",
        'check_btn': "I joined ✅",
        'send_link': "Welcome! 🚀\nPlease send the video link (IG, TikTok, YouTube...):",
        'downloading': "Processing... ⏳\nPlease wait.",
        'error': "Error! Check the link or file size (Max 50MB).",
        'not_joined': "You haven't joined yet!"
    },
    'fr': {
        'force_join': "Attendez cher! ✋\nRejoignez notre canal pour utiliser le bot.",
        'join_btn': "Rejoindre 📥",
        'check_btn': "C'est fait ✅",
        'send_link': "Bienvenue! 🚀\nEnvoyez le lien de la vidéo:",
        'downloading': "Téléchargement... ⏳",
        'error': "Erreur! Vérifiez le lien.",
        'not_joined': "Vous n'avez pas encore rejoint!"
    },
    'ru': {
        'force_join': "Подождите! ✋\nВступите в наш канал, чтобы использовать бот.",
        'join_btn': "Вступить 📥",
        'check_btn': "Я вступил ✅",
        'send_link': "Добро пожаловать! 🚀\nОтправьте ссылку на видео:",
        'downloading': "Загрузка... ⏳",
        'error': "Ошибка! Проверьте ссылку.",
        'not_joined': "Вы еще не вступили!"
    }
}

user_languages = {}

def check_membership(user_id):
    try:
        member = bot.get_chat_member(CHANNEL_USERNAME, user_id)
        return member.status in ['member', 'administrator', 'creator']
    except:
        return False

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup(row_width=2)
    markup.add(
        InlineKeyboardButton("🇲🇦 العربية", callback_data="lang_ar"),
        InlineKeyboardButton("🇺🇸 English", callback_data="lang_en"),
        InlineKeyboardButton("🇫🇷 Français", callback_data="lang_fr"),
        InlineKeyboardButton("🇷🇺 Русский", callback_data="lang_ru")
    )
    bot.send_message(message.chat.id, "Select Language / اختر اللغة:", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    user_id = call.from_user.id
    if call.data.startswith('lang_'):
        lang = call.data.split('_')[1]
        user_languages[user_id] = lang
        if not check_membership(user_id):
            markup = InlineKeyboardMarkup().add(
                InlineKeyboardButton(TEXTS[lang]['join_btn'], url=f"https://t.me/{CHANNEL_USERNAME[1:]}"),
                InlineKeyboardButton(TEXTS[lang]['check_btn'], callback_data="check_now")
            )
            bot.edit_message_text(TEXTS[lang]['force_join'], call.message.chat.id, call.message.message_id, reply_markup=markup)
        else:
            bot.edit_message_text(TEXTS[lang]['send_link'], call.message.chat.id, call.message.message_id)
    
    elif call.data == "check_now":
        lang = user_languages.get(user_id, 'ar')
        if check_membership(user_id):
            bot.edit_message_text(TEXTS[lang]['send_link'], call.message.chat.id, call.message.message_id)
        else:
            bot.answer_callback_query(call.id, TEXTS[lang]['not_joined'], show_alert=True)

@bot.message_handler(func=lambda message: True)
def handle_download(message):
    user_id = message.from_user.id
    lang = user_languages.get(user_id, 'ar')
    
    if not check_membership(user_id):
        send_welcome(message)
        return

    url = message.text
    if not url.startswith('http'):
        bot.reply_to(message, TEXTS[lang]['send_link'])
        return

    status_msg = bot.reply_to(message, TEXTS[lang]['downloading'])
    
    # إعدادات التحميل (أفضل جودة ممكنة تحت 50 ميجا لتيليجرام)
    ydl_opts = {
        'format': 'best[filesize<50M]/best',
        'outtmpl': f'vid_{user_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
        with open(filename, 'rb') as video:
            bot.send_video(message.chat.id, video, caption="Done by @zsewwi 🔥")
        
        os.remove(filename)
        bot.delete_message(message.chat.id, status_msg.message_id)
    except Exception as e:
        bot.edit_message_text(TEXTS[lang]['error'], message.chat.id, status_msg.message_id)

if __name__ == "__main__":
    keep_alive()
    print("Bot is Starting...")
    bot.infinity_polling()
