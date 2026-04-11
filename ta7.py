import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
import yt_dlp
import os

# إعدادات البوت والقناة
TOKEN = '8788224553:AAF7NORu-kU6mEjy8vz_3Bqtwjw4ZoESgF8'
CHANNEL_USERNAME = '@zsewwi'
bot = telebot.TeleBot(TOKEN)

# قاموس لتخزين لغة كل مستخدم
user_languages = {}

# قاموس النصوص المترجمة لتوفير واجهة فخمة
TEXTS = {
    'ar': {
        'force_join': "تمهل عزيزي! ✋\nيجب عليك الانضمام أولاً إلى قناتنا لتتمكن من استخدام البوت الاستثنائي الخاص بنا.",
        'join_btn': "انضم إلى القناة من هنا 📥",
        'check_btn': "تحقق من الانضمام ✅",
        'send_link': "مرحباً بك في البوت الأسطوري! 🚀\nالمرجو إرسال رابط الفيديو الذي تريد تحميله من أي موقع (يوتيوب، إنستغرام، تيك توك...):",
        'downloading': "جاري معالجة الرابط وتحميل الفيديو بأفضل جودة... ⏳\nالرجاء الانتظار قليلاً.",
        'error': "عذراً، حدث خطأ أثناء التحميل. تأكد من الرابط أو حاول مجدداً لاحقاً.",
        'not_joined': "عذراً، لم تقم بالانضمام بعد! انضم ثم اضغط على تحقق."
    },
    'en': {
        'force_join': "Hold on dear! ✋\nYou must join our channel first to use our premium bot.",
        'join_btn': "Join Channel Here 📥",
        'check_btn': "Check Join ✅",
        'send_link': "Welcome to the Epic Bot! 🚀\nPlease send the video link you want to download (YouTube, IG, TikTok...):",
        'downloading': "Processing and downloading in best quality... ⏳\nPlease wait.",
        'error': "Sorry, an error occurred. Check the link or try again later.",
        'not_joined': "You haven't joined yet! Please join and click check."
    },
    'fr': {
        'force_join': "Attendez cher! ✋\nVous devez d'abord rejoindre notre canal pour utiliser le bot.",
        'join_btn': "Rejoindre le canal 📥",
        'check_btn': "Vérifier ✅",
        'send_link': "Bienvenue sur le Bot Épique ! 🚀\nVeuillez envoyer le lien de la vidéo (YouTube, IG, TikTok...):",
        'downloading': "Téléchargement en cours... ⏳\nVeuillez patienter.",
        'error': "Une erreur est survenue. Vérifiez le lien.",
        'not_joined': "Vous n'avez pas encore rejoint! Rejoignez puis vérifiez."
    },
    'ru': {
        'force_join': "Подождите, дорогой! ✋\nВы должны сначала присоединиться к нашему каналу.",
        'join_btn': "Присоединиться к каналу 📥",
        'check_btn': "Проверить ✅",
        'send_link': "Добро пожаловать в Эпический Бот! 🚀\nОтправьте ссылку на видео:",
        'downloading': "Загрузка видео... ⏳\nПожалуйста, подождите.",
        'error': "Произошла ошибка. Проверьте ссылку.",
        'not_joined': "Вы еще не присоединились! Сделайте это и нажмите кнопку проверки."
    }
}

# دالة التحقق من الاشتراك
def check_membership(user_id):
    try:
        member = bot.get_chat_member(CHANNEL_USERNAME, user_id)
        if member.status in ['member', 'administrator', 'creator']:
            return True
        return False
    except Exception as e:
        return False

# رسالة البدء واختيار اللغة
@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = InlineKeyboardMarkup(row_width=2)
    btn_ar = InlineKeyboardButton("🇲🇦 العربية", callback_data="lang_ar")
    btn_en = InlineKeyboardButton("🇺🇸 English", callback_data="lang_en")
    btn_fr = InlineKeyboardButton("🇫🇷 Français", callback_data="lang_fr")
    btn_ru = InlineKeyboardButton("🇷🇺 Русский", callback_data="lang_ru")
    markup.add(btn_ar, btn_en, btn_fr, btn_ru)
    
    bot.send_message(message.chat.id, "Please select your language / المرجو اختيار لغتك:", reply_markup=markup)

# التعامل مع أزرار اللغة والتحقق
@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    user_id = call.from_user.id
    
    if call.data.startswith('lang_'):
        lang = call.data.split('_')[1]
        user_languages[user_id] = lang
        
        if not check_membership(user_id):
            markup = InlineKeyboardMarkup(row_width=1)
            btn_join = InlineKeyboardButton(TEXTS[lang]['join_btn'], url=f"https://t.me/{CHANNEL_USERNAME[1:]}")
            btn_check = InlineKeyboardButton(TEXTS[lang]['check_btn'], callback_data="check_join")
            markup.add(btn_join, btn_check)
            bot.edit_message_text(TEXTS[lang]['force_join'], chat_id=call.message.chat.id, message_id=call.message.message_id, reply_markup=markup)
        else:
            bot.edit_message_text(TEXTS[lang]['send_link'], chat_id=call.message.chat.id, message_id=call.message.message_id)
            
    elif call.data == 'check_join':
        lang = user_languages.get(user_id, 'ar')
        if check_membership(user_id):
            bot.edit_message_text(TEXTS[lang]['send_link'], chat_id=call.message.chat.id, message_id=call.message.message_id)
        else:
            bot.answer_callback_query(call.id, TEXTS[lang]['not_joined'], show_alert=True)

# التعامل مع الروابط وتحميل الفيديوهات
@bot.message_handler(func=lambda message: True)
def handle_message(message):
    user_id = message.from_user.id
    lang = user_languages.get(user_id, 'ar')
    
    # التحقق مرة أخرى من الاشتراك قبل التحميل
    if not check_membership(user_id):
        markup = InlineKeyboardMarkup(row_width=1)
        btn_join = InlineKeyboardButton(TEXTS[lang]['join_btn'], url=f"https://t.me/{CHANNEL_USERNAME[1:]}")
        btn_check = InlineKeyboardButton(TEXTS[lang]['check_btn'], callback_data="check_join")
        markup.add(btn_join, btn_check)
        bot.send_message(message.chat.id, TEXTS[lang]['force_join'], reply_markup=markup)
        return

    url = message.text
    if not url.startswith('http'):
        bot.send_message(message.chat.id, TEXTS[lang]['send_link'])
        return

    msg = bot.send_message(message.chat.id, TEXTS[lang]['downloading'])
    
    # إعدادات yt-dlp لجلب الفيديو بأفضل جودة تحت 50MB
    ydl_opts = {
        'format': 'best[filesize<50M]/best',
        'outtmpl': f'video_{user_id}.%(ext)s',
        'quiet': True,
        'cookiefile': 'cookies.txt', # اختياري إذا أردت دعم مواقع تحتاج تسجيل دخول
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
        with open(filename, 'rb') as video:
            bot.send_video(message.chat.id, video, caption="Enjoy! 🔥")
            
        # حذف الفيديو بعد الإرسال لتوفير المساحة
        os.remove(filename)
        bot.delete_message(message.chat.id, msg.message_id)
        
    except Exception as e:
        bot.edit_message_text(TEXTS[lang]['error'], chat_id=message.chat.id, message_id=msg.message_id)
        print(f"Error: {e}")

# تشغيل البوت
if __name__ == "__main__":
    print("Bot is running...")
    bot.infinity_polling()
