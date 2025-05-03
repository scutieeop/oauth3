const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// Backup modeli
const BackupSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  guildName: { type: String },
  users: [{
    id: String,
    username: String,
    roles: [String]
  }],
  createdAt: { type: Date, default: Date.now }
});

const Backup = mongoose.models.Backup || mongoose.model('Backup', BackupSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yedeklerilistele')
    .setDescription('Tüm sunucu yedeklerini listeler'),
  
  async execute(interaction, client) {
    // Sadece sunucu sahiplerinin veya adminlerin kullanabilmesi için izin kontrolü
    if (!interaction.memberPermissions.has('ADMINISTRATOR')) {
      return interaction.reply({ 
        content: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor.', 
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    try {
      // Tüm yedekleri getir
      const backups = await Backup.find({}).sort({ createdAt: -1 }).limit(25);
      
      if (!backups || backups.length === 0) {
        return interaction.editReply({
          content: '❌ Henüz hiç yedek oluşturulmamış.'
        });
      }
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setTitle('Sunucu Yedekleri')
        .setColor('#7289DA')
        .setDescription(`Toplam **${backups.length}** adet yedek bulundu.`)
        .setTimestamp()
        .setFooter({ 
          text: `${interaction.user.username} tarafından istendi`, 
          iconURL: interaction.user.displayAvatarURL() 
        });
      
      // Her yedeği ekle
      backups.forEach((backup, index) => {
        const date = new Date(backup.createdAt);
        const dateString = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        embed.addFields({ 
          name: `#${index + 1} - ${backup.guildName || 'İsimsiz Sunucu'}`, 
          value: `**ID:** ${backup.guildId}\n**Kullanıcı Sayısı:** ${backup.users.length}\n**Tarih:** ${dateString}\n\u200B` 
        });
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Yedekleri listeleme hatası:', error);
      await interaction.editReply({
        content: '❌ Yedekler listelenirken bir hata oluştu.'
      });
    }
  }
}; 