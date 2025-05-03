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
    .setName('doğrulamadurum')
    .setDescription('Doğrulama sistemi ayarlarını gösterir')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const guildId = interaction.guild.id;
      
      // Veritabanından ayarları al
      const settings = await GuildSettings.findOne({ guildId });
      
      if (!settings) {
        return interaction.editReply({
          content: '❌ Bu sunucu için henüz doğrulama ayarları yapılmamış.'
        });
      }
      
      // Embed oluştur
      const statusEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔐 Doğrulama Sistemi Durumu')
        .setDescription(`**${interaction.guild.name}** sunucusu için doğrulama sistemi ayarları`)
        .addFields(
          { 
            name: '📝 Log Kanalı', 
            value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Ayarlanmamış' 
          },
          { 
            name: '🏅 Doğrulama Rolü', 
            value: settings.verificationRoleId ? `<@&${settings.verificationRoleId}>` : 'Ayarlanmamış' 
          },
          { 
            name: '🔘 Doğrulama Buton Kanalı', 
            value: settings.verificationButtonChannelId ? `<#${settings.verificationButtonChannelId}>` : 'Ayarlanmamış' 
          },
          { 
            name: '💬 Özel Mesaj', 
            value: settings.customMessage ? settings.customMessage : 'Varsayılan mesaj' 
          }
        )
        .setTimestamp()
        .setFooter({ text: `Son Güncelleme: ${new Date(settings.updatedAt).toLocaleString('tr-TR')}` });
      
      await interaction.editReply({
        embeds: [statusEmbed]
      });
      
    } catch (error) {
      console.error('Doğrulama durum komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.'
      });
    }
  }
}; 