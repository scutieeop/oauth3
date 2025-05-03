const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
    .setName('yedekle')
    .setDescription('Yetkili kullanıcıları yedekler')
    .addBooleanOption(option =>
      option.setName('detaylı')
        .setDescription('Detaylı bilgi gösterir'))
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
    
    // Detaylı bilgi gösterilsin mi?
    const showDetails = interaction.options.getBoolean('detaylı') || false;
    
    // İlk bilgilendirme embedini gönder
    const initialEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 Yedekleme İşlemi Başlatılıyor')
      .setDescription(`**${interaction.guild.name}** sunucusundaki yetkili kullanıcılar yedekleniyor...`)
      .setTimestamp()
      .setFooter({ text: `${interaction.user.tag} tarafından talep edildi`, iconURL: interaction.user.displayAvatarURL() });
    
    await interaction.editReply({ embeds: [initialEmbed] });
    
    try {
      // Sunucu üyelerini al
      const guild = interaction.guild;
      const members = await guild.members.fetch();
      
      // Kullanıcı listesi oluştur
      const authorizedUsers = [];
      let processedCount = 0;
      let totalMembers = members.size;
      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 5000; // 5 saniye
      
      // İlerleme güncellemesi
      const updateProgressEmbed = async () => {
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) return;
        
        lastUpdateTime = now;
        
        const percentage = Math.floor((processedCount / totalMembers) * 100);
        const progressBar = '▰'.repeat(Math.floor(percentage / 10)) + '▱'.repeat(10 - Math.floor(percentage / 10));
        
        const progressEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('🔄 Kullanıcılar Yedekleniyor')
          .setDescription(`**${guild.name}** sunucusundaki yetkili kullanıcılar kontrol ediliyor...`)
          .addFields(
            { name: 'İlerleme', value: `${progressBar} ${percentage}% (${processedCount}/${totalMembers})` },
            { name: 'Bulunan Yetkililer', value: `**${authorizedUsers.length}** yetkili kullanıcı bulundu.` }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [progressEmbed] });
      };
      
      // Her üye için kontrol et
      for (const [id, member] of members) {
        // Bot değilse ve MongoDB'de kaydı varsa
        if (!member.user.bot) {
          const isAuthorized = await tokenService.isUserAuthorized(id);
          
          if (isAuthorized) {
            authorizedUsers.push({
              id: member.user.id,
              username: member.user.username,
              roles: Array.from(member.roles.cache.keys())
            });
          }
        }
        
        processedCount++;
        await updateProgressEmbed();
      }
      
      // Önceki yedeklerin sayısını al
      const previousBackupCount = await Backup.countDocuments({ guildId: guild.id });
      
      // Backup oluştur
      const backup = new Backup({
        guildId: guild.id,
        guildName: guild.name,
        users: authorizedUsers
      });
      
      await backup.save();
      
      // Kullanıcı listesi (en fazla 15 kullanıcı)
      let userList = '';
      if (showDetails && authorizedUsers.length > 0) {
        const displayUsers = authorizedUsers.slice(0, 15);
        
        displayUsers.forEach((user, index) => {
          userList += `${index + 1}. <@${user.id}> (${user.username})\n`;
        });
        
        if (authorizedUsers.length > 15) {
          userList += `\n...ve ${authorizedUsers.length - 15} kullanıcı daha`;
        }
      }
      
      // Sonuç bildirimi
      const resultEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Yedekleme İşlemi Tamamlandı')
        .setDescription(`**${guild.name}** sunucusundaki yetkili kullanıcılar başarıyla yedeklendi!`)
        .addFields(
          { name: '📊 Yedekleme İstatistikleri', value: 
            `📋 Yedeklenen Kullanıcı: **${authorizedUsers.length}**\n` +
            `👥 Toplam Üye: **${totalMembers}**\n` +
            `🗃️ Önceki Yedek Sayısı: **${previousBackupCount}**\n` +
            `🆔 Yedek ID: \`${backup._id}\``
          }
        )
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag} tarafından talep edildi`, iconURL: interaction.user.displayAvatarURL() });
      
      // Kullanıcı listesini göster (eğer detaylı istendiyse)
      if (showDetails && userList) {
        resultEmbed.addFields({ name: '👤 Yedeklenen Kullanıcılar', value: userList });
      }
      
      await interaction.editReply({ embeds: [resultEmbed] });
      
    } catch (error) {
      console.error('Yedekleme hatası:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Hata Oluştu')
        .setDescription('Yetkili kullanıcılar yedeklenirken bir hata oluştu.')
        .addFields({ name: 'Hata Detayı', value: `\`\`\`${error.message}\`\`\`` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}; 