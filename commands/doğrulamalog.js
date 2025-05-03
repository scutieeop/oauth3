const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

// Ayarlar şeması oluştur
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
    .setName('doğrulamalog')
    .setDescription('Doğrulanan kullanıcılar için log kanalını ayarlar')
    .addChannelOption(option => 
      option.setName('kanal')
        .setDescription('Log kanalı olarak ayarlanacak kanal')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const logChannel = interaction.options.getChannel('kanal');
      const guildId = interaction.guild.id;
      
      // Kanal türünü kontrol et
      if (!logChannel.isTextBased()) {
        return interaction.editReply({
          content: '❌ Lütfen metin tabanlı bir kanal seçin.'
        });
      }
      
      // Veritabanında ayarları güncelle veya oluştur
      let settings = await GuildSettings.findOne({ guildId });
      
      if (settings) {
        settings.logChannelId = logChannel.id;
        settings.updatedAt = new Date();
      } else {
        settings = new GuildSettings({
          guildId,
          logChannelId: logChannel.id
        });
      }
      
      await settings.save();
      
      await interaction.editReply({
        content: `✅ Doğrulama log kanalı <#${logChannel.id}> olarak ayarlandı!`
      });
      
    } catch (error) {
      console.error('Doğrulama log komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.'
      });
    }
  }
}; 