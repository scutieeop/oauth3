const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');

// GuildSettings şeması
const GuildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String },
  verificationRoleId: { type: String },
  verificationMessageId: { type: String },
  verificationButtonChannelId: { type: String },
  customMessage: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

const GuildSettings = mongoose.models.GuildSettings || mongoose.model('GuildSettings', GuildSettingsSchema);

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client, config) {
    try {
      const guildId = member.guild.id;
      
      // Sunucu ayarlarını kontrol et
      const settings = await GuildSettings.findOne({ guildId });
      
      // Sunucu ayarları yoksa bile config'den varsayılan mesajı kontrol et
      const defaultMessage = config?.verification?.defaultMessage || 
        "Sunucumuza erişmek için hesabınızı doğrulamanız gerekmektedir. Aşağıdaki butona tıklayarak doğrulama işlemini gerçekleştirebilirsiniz.";
      
      // Mesaj öncelik sırası: 1) Sunucu ayarlarındaki mesaj, 2) Varsayılan mesaj
      const verificationMessage = settings?.customMessage || defaultMessage;
      
      if (!verificationMessage) {
        console.log(`[${member.guild.name}] DM mesajı ayarlanmamış, üyeye mesaj gönderilmiyor: ${member.user.tag}`);
        return;
      }
      
      // DM göndermeden önce enableDMNotification ayarını kontrol et
      const enableDMNotification = config?.verification?.enableDMNotification !== false;
      if (!enableDMNotification) {
        console.log(`[${member.guild.name}] DM bildirimleri devre dışı, üyeye mesaj gönderilmiyor: ${member.user.tag}`);
        return;
      }
      
      // Embed oluştur
      const verificationEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Hesap Doğrulama')
        .setDescription(verificationMessage)
        .setTimestamp()
        .setFooter({ text: `${member.guild.name} | Rewards Doğrulama Sistemi`, iconURL: client.user.displayAvatarURL() });
      
      // Doğrulama için gerekli buton adı ayarlanmış mı kontrol et
      const buttonText = config?.verification?.buttonText || "Doğrula";
      
      // Button oluştur
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel(buttonText)
            .setURL('https://auth2-bot.vercel.app/')
            .setStyle(ButtonStyle.Link)
        );
      
      // DM gönder
      try {
        await member.send({
          embeds: [verificationEmbed],
          components: [row]
        });
        console.log(`[${member.guild.name}] Kullanıcıya doğrulama DM'i gönderildi: ${member.user.tag}`);
      } catch (dmError) {
        console.error(`[${member.guild.name}] Kullanıcıya DM gönderilemedi: ${member.user.tag}`, dmError.message);
        
        // Eğer log kanalı ayarlanmışsa, DM gönderilemeyen kullanıcı için bildirim gönder
        if (settings?.logChannelId) {
          const logChannel = member.guild.channels.cache.get(settings.logChannelId);
          if (logChannel) {
            const errorEmbed = new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('⚠️ DM Gönderilemiyor')
              .setDescription(`<@${member.id}> (${member.user.tag}) kullanıcısına DM gönderilemedi. Muhtemelen DM'leri kapalı.`)
              .setTimestamp()
              .setFooter({ text: 'Rewards Doğrulama Sistemi', iconURL: client.user.displayAvatarURL() });
            
            await logChannel.send({ embeds: [errorEmbed] }).catch(e => {
              console.error(`Log kanalına da mesaj gönderilemedi:`, e.message);
            });
          }
        }
        return; // DM gönderilemedi, fonksiyondan çık
      }
      
      // Log kanalına bilgi gönder
      if (settings?.logChannelId) {
        const logChannel = member.guild.channels.cache.get(settings.logChannelId);
        
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('👋 Yeni Kullanıcı')
            .setDescription(`<@${member.id}> (${member.user.tag}) sunucuya katıldı ve doğrulama mesajı gönderildi.`)
            .setTimestamp()
            .setFooter({ text: 'Rewards Doğrulama Sistemi', iconURL: client.user.displayAvatarURL() });
          
          await logChannel.send({ embeds: [logEmbed] }).catch(e => {
            console.error(`Log kanalına mesaj gönderilemedi:`, e.message);
          });
        }
      }
    } catch (error) {
      console.error(`Üye katılma ve DM gönderme hatası (${member.guild.name}/${member.user.tag}):`, error);
    }
  },
}; 