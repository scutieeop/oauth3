const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
    .setName('doğrulamarol')
    .setDescription('Doğrulanan kullanıcılara verilecek rolü ayarlar')
    .addRoleOption(option => 
      option.setName('rol')
        .setDescription('Doğrulanan kullanıcılara verilecek rol')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const role = interaction.options.getRole('rol');
      const guildId = interaction.guild.id;
      
      // Botun rolü verebilmesini kontrol et
      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.editReply({
          content: '❌ Bu rol benim en yüksek rolümden daha yüksek! Lütfen bot rolünü en üste taşıyın veya başka bir rol seçin.'
        });
      }
      
      // Veritabanında ayarları güncelle veya oluştur
      let settings = await GuildSettings.findOne({ guildId });
      
      if (settings) {
        settings.verificationRoleId = role.id;
        settings.updatedAt = new Date();
      } else {
        settings = new GuildSettings({
          guildId,
          verificationRoleId: role.id
        });
      }
      
      await settings.save();
      
      await interaction.editReply({
        content: `✅ Doğrulama rolü <@&${role.id}> olarak ayarlandı!`
      });
      
    } catch (error) {
      console.error('Doğrulama rol komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.'
      });
    }
  }
}; 