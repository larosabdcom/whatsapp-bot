const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// ============================
// CONFIG — এখানে পরিবর্তন করুন
// ============================
const CONFIG = {
  sourceGroups: ['Pakistan Wholesale', 'PKR Dress'],
  targetGroups: ['My Dress Shop', 'My Customer Group'],
  formula: { divisor: 2.1, markup: 3.5 },
  prefix: '🛍️ *নতুন কালেকশন!*\n',
  suffix: '\n\n📞 অর্ডার: 01XXXXXXXXX'
};

function convertPrice(pkr) {
  return Math.ceil(pkr / CONFIG.formula.divisor + pkr * CONFIG.formula.markup / 100);
}

function processText(text) {
  if (!text) return text;
  return text.replace(/\b(\d{3,6})\b/g, (match, num) => {
    const pkr = parseInt(num);
    if (pkr >= 200 && pkr <= 99999) {
      return `${num}PKR → *৳${convertPrice(pkr).toLocaleString()}*`;
    }
    return match;
  });
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--disable-dev-shm-usage', '--no-first-run',
           '--disable-gpu', '--single-process']
  }
});

client.on('qr', qr => {
  console.log('\n📱 QR Code স্ক্যান করুন:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('✅ Bot চালু! মেসেজ দেখছে...');
  const chats = await client.getChats();
  console.log('📋 গ্রুপ তালিকা:');
  chats.filter(c => c.isGroup).forEach(g => console.log(' -', g.name));
});

client.on('message_create', async (msg) => {
  try {
    if (!msg.from.endsWith('@g.us')) return;
    const chat = await msg.getChat();
    const isSource = CONFIG.sourceGroups.some(s =>
      chat.name.toLowerCase().includes(s.toLowerCase()));
    if (!isSource) return;

    console.log(`📩 মেসেজ পেলাম: ${chat.name}`);

    const allChats = await client.getChats();
    const targets = allChats.filter(c =>
      c.isGroup && CONFIG.targetGroups.some(t =>
        c.name.toLowerCase().includes(t.toLowerCase())));

    for (const target of targets) {
      const newText = CONFIG.prefix + processText(msg.body) + CONFIG.suffix;
      if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        await target.sendMessage(media, { caption: newText });
      } else {
        await target.sendMessage(newText);
      }
      console.log(`✅ পাঠানো হয়েছে: ${target.name}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
});

client.initialize();
