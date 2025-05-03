const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
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
    .setName('kullaniciekle')
    .setDescription('Yetkili kullanıcıları bu sunucuya ekler')
    .addStringOption(option => 
      option.setName('kaynak')
        .setDescription('Kullanıcıların alınacağı sunucu ID')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('tümünü_ekle')
        .setDescription('Tüm kullanıcıları ekle (varsayılan: false)'))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Eklenecek maksimum kullanıcı sayısı')
        .setMinValue(1)
        .setMaxValue(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    // Sadece sunucu sahiplerinin veya adminlerin kullanabilmesi için izin kontrolü
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ 
        content: '⛔ Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor.', 
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    try {
      const sourceGuildId = interaction.options.getString('kaynak');
      const addAll = interaction.options.getBoolean('tümünü_ekle') || false;
      const userLimit = interaction.options.getInteger('limit') || 0;
      const targetGuild = interaction.guild;
      
      // İlk bilgilendirme embedini gönder
      const initialEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🔄 Kullanıcı Ekleme İşlemi Başlatılıyor')
        .setDescription(`**${sourceGuildId}** ID'li sunucudan kullanıcılar getiriliyor...`)
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag} tarafından talep edildi`, iconURL: interaction.user.displayAvatarURL() });
      
      await interaction.editReply({ embeds: [initialEmbed] });
      
      // Kaynak sunucunun en son yedeğini bul
      const backup = await Backup.findOne({ guildId: sourceGuildId }).sort({ createdAt: -1 });
      
      if (!backup) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Yedek Bulunamadı')
          .setDescription(`**${sourceGuildId}** ID'li sunucu için yedek bulunamadı.`)
          .setTimestamp();
        
        return interaction.editReply({ embeds: [errorEmbed] });
      }
      
      // Eklenen kullanıcı sayısı
      let successCount = 0;
      let errorCount = 0;
      let notAuthorizedCount = 0;
      
      // İlerleme bildirmek için güncelleme zamanı
      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 5000; // 5 saniyede bir güncelleme
      
      // Kullanıcı işleme limiti
      const users = backup.users;
      const usersToProcess = userLimit > 0 && userLimit < users.length ? users.slice(0, userLimit) : users;
      
      // İlerleme embedini güncelle
      const updateProgressEmbed = async (current, total, isComplete = false) => {
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL && !isComplete) return;
        
        lastUpdateTime = now;
        
        const percentage = Math.floor((current / total) * 100);
        const progressBar = '▰'.repeat(Math.floor(percentage / 10)) + '▱'.repeat(10 - Math.floor(percentage / 10));
        
        const progressEmbed = new EmbedBuilder()
          .setColor(isComplete ? 0x00FF00 : 0xFFA500)
          .setTitle(isComplete ? '✅ Kullanıcı Ekleme Tamamlandı' : '🔄 Kullanıcılar Ekleniyor')
          .setDescription(`**${backup.guildName || sourceGuildId}** sunucusundan **${targetGuild.name}** sunucusuna kullanıcılar ekleniyor.`)
          .addFields(
            { name: 'İlerleme', value: `${progressBar} ${percentage}% (${current}/${total})` },
            { name: 'Durum', value: `✅ Başarılı: **${successCount}**\n❌ Başarısız: **${errorCount}**\n⚠️ Yetkisiz: **${notAuthorizedCount}**` }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [progressEmbed] });
      };
      
      // Her kullanıcı için
      for (let i = 0; i < usersToProcess.length; i++) {
        const user = usersToProcess[i];
        
        try {
          // Kullanıcının token'ını al
          const tokenData = await tokenService.getUserToken(user.id);
          
          if (!tokenData && !addAll) {
            notAuthorizedCount++;
            // İlerlemeyi güncelle
            await updateProgressEmbed(i + 1, usersToProcess.length);
            continue;
          }
          
          // Discord API'sına istek at
          await axios.put(
            `https://discord.com/api/v10/guilds/${targetGuild.id}/members/${user.id}`,
            {},
            {
              headers: {
                'Authorization': `Bot ${client.token}`,
                'X-Audit-Log-Reason': 'Auth2Bot otomatik kullanıcı ekleme'
              }
            }
          );
          
          successCount++;
        } catch (error) {
          console.error(`Kullanıcı ekleme hatası (${user.id}):`, error.response?.data || error.message);
          errorCount++;
        }
        
        // İlerlemeyi güncelle
        await updateProgressEmbed(i + 1, usersToProcess.length);
      }
      
      // Final güncelleme
      await updateProgressEmbed(usersToProcess.length, usersToProcess.length, true);
      
      // Sonuç bildirimi ekle
      const resultEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Kullanıcı Ekleme İşlemi Tamamlandı')
        .setDescription(`**${backup.guildName || sourceGuildId}** sunucusundan **${targetGuild.name}** sunucusuna kullanıcı ekleme işlemi tamamlandı!`)
        .addFields(
          { name: 'Özet', value: 
            `✅ Başarılı: **${successCount}**\n` +
            `❌ Başarısız: **${errorCount}**\n` +
            `⚠️ Yetkisiz: **${notAuthorizedCount}**\n` +
            `📊 Toplam İşlenen: **${usersToProcess.length}**\n` +
            `📋 Yedekteki Toplam: **${backup.users.length}**`
          },
          { name: '📅 Yedek Tarihi', value: new Date(backup.createdAt).toLocaleString('tr-TR') }
        )
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag} tarafından talep edildi`, iconURL: interaction.user.displayAvatarURL() });
      
      await interaction.editReply({ embeds: [resultEmbed] });
      
    } catch (error) {
      console.error('Kullanıcı ekleme hatası:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Hata Oluştu')
        .setDescription('Kullanıcılar eklenirken bir hata oluştu.')
        .addFields({ name: 'Hata Detayı', value: `\`\`\`${error.message}\`\`\`` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}; 