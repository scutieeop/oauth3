const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// User Token şemasını tanımla
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kullanicilistele')
    .setDescription('Yetkilendirilmiş tüm kullanıcıları listeler'),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      // Sadece sunucu sahibi veya yöneticiler kullanabilir
      if (!interaction.memberPermissions.has('Administrator') && 
          interaction.guild.ownerId !== interaction.user.id) {
        return interaction.editReply({ 
          content: '⛔ Bu komutu kullanma izniniz yok. Yönetici yetkisine sahip olmalısınız.',
          ephemeral: true 
        });
      }
      
      // Veritabanından tüm kullanıcıları çek
      const userTokens = await UserToken.find().sort({ createdAt: -1 });
      
      if (!userTokens || userTokens.length === 0) {
        return interaction.editReply({
          content: 'Yetkilendirilmiş kullanıcı bulunamadı.',
          ephemeral: true
        });
      }
      
      // Kullanıcı sayısını hesapla
      const userCount = userTokens.length;
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle('🔐 Yetkilendirilmiş Kullanıcılar')
        .setDescription(`Toplam **${userCount}** kullanıcı yetkilendirilmiş.`)
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() });
      
      // Her 10 kullanıcıyı bir alan olarak ekle (Discord limite sahip)
      const chunks = [];
      for (let i = 0; i < userTokens.length; i += 10) {
        chunks.push(userTokens.slice(i, i + 10));
      }
      
      // En fazla 5 alan ekle (Discord limite sahip)
      const maxFields = Math.min(chunks.length, 5);
      
      for (let i = 0; i < maxFields; i++) {
        const chunk = chunks[i];
        let fieldValue = '';
        
        chunk.forEach((user, index) => {
          // Token durumunu kontrol et (süresi dolmuş mu?)
          const isExpired = Date.now() > user.expiresAt;
          const status = isExpired ? '🔴' : '🟢';
          
          fieldValue += `${status} <@${user.userId}> (${user.username})\n`;
        });
        
        embed.addFields({
          name: `Kullanıcı Listesi - Sayfa ${i + 1}/${maxFields}`,
          value: fieldValue || 'Kullanıcı yok',
        });
      }
      
      if (userTokens.length > 50) {
        embed.addFields({
          name: '⚠️ Not',
          value: `Toplam ${userTokens.length} kullanıcıdan sadece 50 tanesi gösteriliyor.`
        });
      }
      
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Kullanıcı listeleme hatası:', error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Kullanıcılar listelenirken bir hata oluştu.');
      } else {
        await interaction.reply({ content: 'Kullanıcılar listelenirken bir hata oluştu.', ephemeral: true });
      }
    }
  },
}; 