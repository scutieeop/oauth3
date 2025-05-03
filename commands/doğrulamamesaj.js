const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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
  data: new SlashCommandBuilder()
    .setName('doğrulamamesaj')
    .setDescription('DM üzerinden gönderilecek doğrulama mesajını ayarlar')
    .addStringOption(option => 
      option.setName('mesaj')
        .setDescription('Kullanıcıya gönderilecek mesaj')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const message = interaction.options.getString('mesaj');
      const guildId = interaction.guild.id;
      
      // Veritabanında ayarları güncelle veya oluştur
      let settings = await GuildSettings.findOne({ guildId });
      
      if (settings) {
        settings.customMessage = message;
        settings.updatedAt = new Date();
      } else {
        settings = new GuildSettings({
          guildId,
          customMessage: message
        });
      }
      
      await settings.save();
      
      // Örnek mesajı göster
      const exampleEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Doğrulama Mesajı')
        .setDescription(message)
        .setFooter({ text: 'Bu mesaj örnek gösterimdir.' });
      
      await interaction.editReply({
        content: '✅ Doğrulama mesajı başarıyla ayarlandı! Aşağıda örnek görünümü görebilirsiniz:',
        embeds: [exampleEmbed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'Doğrula',
                url: 'https://auth2-bot.vercel.app/'
              }
            ]
          }
        ]
      });
      
    } catch (error) {
      console.error('Doğrulama mesaj komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.'
      });
    }
  }
}; 