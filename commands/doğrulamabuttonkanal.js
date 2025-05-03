const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    .setName('doğrulamabuttonkanal')
    .setDescription('Doğrulama butonunun olacağı kanalı ayarlar')
    .addChannelOption(option => 
      option.setName('kanal')
        .setDescription('Doğrulama butonunun olacağı kanal')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const channel = interaction.options.getChannel('kanal');
      const guildId = interaction.guild.id;
      
      // Kanal türünü kontrol et
      if (!channel.isTextBased()) {
        return interaction.editReply({
          content: '❌ Lütfen metin tabanlı bir kanal seçin.'
        });
      }
      
      // Embed oluştur
      const verificationEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Hesap Doğrulama')
        .setDescription('Hesabınızı doğrulamışsanız buttona tıklayınız')
        .setTimestamp()
        .setFooter({ text: 'Discord Doğrulama Sistemi', iconURL: client.user.displayAvatarURL() });
      
      // Button oluştur
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('verify')
            .setLabel('Doğrula')
            .setStyle(ButtonStyle.Success)
        );
      
      // Kanala mesaj gönder
      const sentMessage = await channel.send({
        embeds: [verificationEmbed],
        components: [row]
      });
      
      // Veritabanında ayarları güncelle veya oluştur
      let settings = await GuildSettings.findOne({ guildId });
      
      if (settings) {
        settings.verificationButtonChannelId = channel.id;
        settings.verificationMessageId = sentMessage.id;
        settings.updatedAt = new Date();
      } else {
        settings = new GuildSettings({
          guildId,
          verificationButtonChannelId: channel.id,
          verificationMessageId: sentMessage.id
        });
      }
      
      await settings.save();
      
      await interaction.editReply({
        content: `✅ Doğrulama butonu <#${channel.id}> kanalına başarıyla eklendi!`
      });
      
    } catch (error) {
      console.error('Doğrulama buton kanal komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu! Lütfen daha sonra tekrar deneyin.'
      });
    }
  }
}; 