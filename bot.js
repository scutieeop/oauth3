// Discord Bot - Bağımsız çalıştırılacak dosya (Ayrı bir sunucu gerektirir, Vercel'de çalışmaz)
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// SUNUCU KURULUM BİLGİLERİ:
// 1. Herhangi bir VPS, Dedicated veya Cloud sunucuya bu dosyayı yükleyin (Vercel değil)
// 2. node bot.js veya npm run bot komutuyla çalıştırın
// 3. Aşağıdaki çevre değişkenlerini sunucuda tanımlayın veya .env dosyasına ekleyin:
//    - DISCORD_BOT_TOKEN: Discord bot token'ı
//    - DISCORD_CLIENT_ID: Discord client ID
//    - DISCORD_CLIENT_SECRET: Discord client secret
//    - MONGODB_URI: MongoDB bağlantı URI'si (web uygulamasıyla aynı veritabanı olmalı)

// Config dosyasını yükle (varsa)
let config = { bot: {}, mongodb: {}, storage: { dir: 'storage' } };
try {
  config = require('./config.json');
} catch (error) {
  console.log('config.json dosyası bulunamadı, sadece çevre değişkenleri kullanılacak.');
}

// Environment variables for overrides
config.bot.token = process.env.DISCORD_BOT_TOKEN || config.bot.token;
config.bot.clientId = process.env.DISCORD_CLIENT_ID || config.bot.clientId; 
config.bot.clientSecret = process.env.DISCORD_CLIENT_SECRET || config.bot.clientSecret;
config.mongodb.uri = process.env.MONGODB_URI || config.mongodb.uri;

// Gerekli yapılandırma kontrolü
if (!config.bot.token) {
  console.error('HATA: DISCORD_BOT_TOKEN çevre değişkeni veya config.json içinde bot.token tanımlanmamış');
  process.exit(1);
}

if (!config.mongodb.uri) {
  console.error('HATA: MONGODB_URI çevre değişkeni veya config.json içinde mongodb.uri tanımlanmamış');
  process.exit(1);
}

// MongoDB bağlantısı
async function connectToMongoDB() {
  try {
    await mongoose.connect(config.mongodb.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB bağlantısı başarılı');
    return true;
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error);
    return false;
  }
}

// MongoDB bağlantı durumunu izle
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB bağlantısı kesildi, yeniden bağlanmaya çalışılıyor...');
  setTimeout(() => connectToMongoDB(), 5000);
});

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Command collection
client.commands = new Collection();
const globalCommands = [];
const guildCommands = [];
const rewardsCommands = [];

// Özel sunucu ID'leri
const SPECIFIC_GUILD_ID = '1364256764018556989';
const REWARDS_GUILD_ID = '1368180792089640970';

// Storage directory setup
const storageDir = path.join(__dirname, config.storage.dir);
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Global Command handler - Tüm sunucularda kullanılabilir
const commandsPath = path.join(__dirname, 'commands');
try {
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    console.log('commands klasörü oluşturuldu, komut dosyalarını buraya ekleyin');
  }
  
  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && !fs.lstatSync(path.join(commandsPath, file)).isDirectory());
  console.log(`${commandFiles.length} global komut dosyası bulundu`);

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      globalCommands.push(command.data.toJSON());
      console.log(`✓ "${command.data.name}" global komutu yüklendi`);
    } else {
      console.log(`✗ "${file}" komut dosyası data veya execute içermiyor`);
    }
  }
} catch (error) {
  console.error('Global komutlar yüklenirken hata:', error);
}

// Guild-specific commands - Sadece belirli sunucularda çalışır (1364256764018556989)
const guildsCommandsPath = path.join(__dirname, 'commands', 'guilds');
try {
  if (!fs.existsSync(guildsCommandsPath)) {
    fs.mkdirSync(guildsCommandsPath, { recursive: true });
    console.log('guilds klasörü oluşturuldu, sunucu komutlarını buraya ekleyin');
  }
  
  const guildCommandFiles = fs.readdirSync(guildsCommandsPath).filter(file => file.endsWith('.js'));
  console.log(`${guildCommandFiles.length} sunucu komutu bulundu`);

  for (const file of guildCommandFiles) {
    const filePath = path.join(guildsCommandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      guildCommands.push(command.data.toJSON());
      console.log(`✓ "${command.data.name}" sunucu komutu yüklendi (Sadece Sunucu ID: ${SPECIFIC_GUILD_ID} için)`);
    } else {
      console.log(`✗ "${file}" sunucu komutu data veya execute içermiyor`);
    }
  }
} catch (error) {
  console.error('Sunucu komutları yüklenirken hata:', error);
}

// Rewards server commands - Sadece rewards sunucusunda çalışır (1368180792089640970)
const rewardsCommandsPath = path.join(__dirname, 'commands', 'rewards');
try {
  if (!fs.existsSync(rewardsCommandsPath)) {
    fs.mkdirSync(rewardsCommandsPath, { recursive: true });
    console.log('rewards klasörü oluşturuldu, rewards sunucu komutlarını buraya ekleyin');
  }
  
  const rewardsCommandFiles = fs.readdirSync(rewardsCommandsPath).filter(file => file.endsWith('.js'));
  console.log(`${rewardsCommandFiles.length} rewards sunucu komutu bulundu`);

  for (const file of rewardsCommandFiles) {
    const filePath = path.join(rewardsCommandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      rewardsCommands.push(command.data.toJSON());
      console.log(`✓ "${command.data.name}" rewards sunucu komutu yüklendi (Sadece Sunucu ID: ${REWARDS_GUILD_ID} için)`);
    } else {
      console.log(`✗ "${file}" rewards sunucu komutu data veya execute içermiyor`);
    }
  }
} catch (error) {
  console.error('Rewards sunucu komutları yüklenirken hata:', error);
}

// Event handler
const eventsPath = path.join(__dirname, 'events');
try {
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    console.log('events klasörü oluşturuldu, olay dosyalarını buraya ekleyin');
  }
  
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  console.log(`${eventFiles.length} olay dosyası bulundu`);

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, config));
      console.log(`✓ "${event.name}" olayı (once) yüklendi`);
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, config));
      console.log(`✓ "${event.name}" olayı yüklendi`);
    }
  }
} catch (error) {
  console.error('Olaylar yüklenirken hata:', error);
}

// Eski komutları temizleme fonksiyonu
async function clearOldCommands() {
  const rest = new REST({ version: '10' }).setToken(config.bot.token);
  
  try {
    console.log('Eski komutlar temizleniyor...');
    
    // Global komutları temizle
    await rest.put(
      Routes.applicationCommands(config.bot.clientId),
      { body: [] }
    );
    
    // Sunucu komutlarını temizle
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, SPECIFIC_GUILD_ID),
      { body: [] }
    );
    
    // Rewards sunucu komutlarını temizle
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, REWARDS_GUILD_ID),
      { body: [] }
    );
    
    console.log('Eski komutlar başarıyla temizlendi.');
  } catch (error) {
    console.error('Eski komutlar temizlenirken hata oluştu:', error);
  }
}

// Temel token servisini oluştur
const UserTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Number, required: true },
  scopes: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UserToken = mongoose.models.UserToken || mongoose.model('UserToken', UserTokenSchema);

// Token servisi
const tokenService = {
  // Kullanıcı yetkili mi kontrol et
  async isUserAuthorized(userId) {
    try {
      const token = await UserToken.findOne({ userId });
      return !!token;
    } catch (error) {
      console.error('Token kontrol hatası:', error);
      return false;
    }
  },
  
  // Token bilgilerini al
  async getUserToken(userId) {
    try {
      const token = await UserToken.findOne({ userId });
      if (!token) return null;
      
      return {
        id: token.userId,
        username: token.username,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        scopes: token.scopes
      };
    } catch (error) {
      console.error('Token alma hatası:', error);
      return null;
    }
  }
};

// Token servisini client'a ekle
client.tokenService = tokenService;

// Bot başlatma
client.once('ready', async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı!`);
  console.log(`Bot ${client.guilds.cache.size} sunucuya hizmet veriyor`);
  
  // Eski komutları temizle
  await clearOldCommands();
  
  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(config.bot.token);
  
  try {
    console.log('Uygulama (/) komutları yenileniyor.');
    
    // Global komutları kaydet
    await rest.put(
      Routes.applicationCommands(config.bot.clientId),
      { body: globalCommands },
    );
    
    // Sunucu komutlarını belirli sunucuya kaydet
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, SPECIFIC_GUILD_ID),
      { body: guildCommands },
    );
    
    // Rewards sunucu komutlarını belirli sunucuya kaydet
    await rest.put(
      Routes.applicationGuildCommands(config.bot.clientId, REWARDS_GUILD_ID),
      { body: rewardsCommands },
    );
    
    console.log('Uygulama (/) komutları başarıyla yenilendi.');
    console.log(`- ${globalCommands.length} global komut kaydedildi`);
    console.log(`- ${guildCommands.length} komut sadece '${SPECIFIC_GUILD_ID}' sunucu ID'sine kaydedildi`);
    console.log(`- ${rewardsCommands.length} komut sadece '${REWARDS_GUILD_ID}' sunucu ID'sine kaydedildi`);
  } catch (error) {
    console.error('Komut kaydetme hatası:', error);
  }

  // Bot durumunu ayarla
  client.user.setPresence({
    activities: [{ name: 'Auth2 Yetkilendirme Botu', type: 0 }],
    status: 'online'
  });

  console.log('Bot hazır ve aktif!');
  console.log('Web uygulamasının da Vercel\'de çalıştığından emin olun!');
});

// Hata yakalayıcılar
process.on('unhandledRejection', (error) => {
  console.error('İşlenmemiş Promise hatası:', error);
});

process.on('uncaughtException', (error) => {
  console.error('İşlenmemiş hata:', error);
  // Kritik hatalarda botu yeniden başlatmak için:
  // process.exit(1);
});

// Ana fonksiyon
async function start() {
  console.log('Auth2Bot başlatılıyor... (Sunucu Versiyonu)');
  console.log('NOT: Bu bot Vercel\'de değil, ayrı bir sunucuda çalışmalıdır!');
  
  // MongoDB'ye bağlan
  const connected = await connectToMongoDB();
  if (!connected) {
    console.error('MongoDB bağlantısı kurulamadı, bot çalışabilir ama veritabanı işlevleri çalışmayacak.');
    console.error('MongoDB URI kontrol edilmeli: ' + (config.mongodb.uri ? 'URI tanımlı' : 'URI tanımlı değil'));
  }

  // Express web server'ı başlat
  setupExpressServer();
  
  // Discord'a bağlan
  try {
    await client.login(config.bot.token);
  } catch (error) {
    console.error('Discord bağlantı hatası:', error);
    process.exit(1);
  }
}

// Express server setup
function setupExpressServer() {
  // Initialize Express app
  const app = express();
  // Update PORT to use Render's PORT environment variable first
  const PORT = process.env.PORT || process.env.WEB_SERVER_PORT || 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files (if needed)
  app.use(express.static(path.join(__dirname, 'public')));

  // Routes
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Auth routes (placeholder, implement your OAuth2 routes)
  app.get('/auth', (req, res) => {
    res.send('Auth endpoint');
  });

  app.get('/auth/callback', (req, res) => {
    res.send('Auth callback endpoint');
  });

  // Start the server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on port ${PORT}`);
  });

  return app;
}

// Başlat
start(); 
