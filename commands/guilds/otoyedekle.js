const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const cron = require('node-cron');

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

// Otomatik yedekleme ayarları modeli
const AutoBackupSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  interval: { type: String, default: 'daily' }, // daily, weekly, monthly
  lastBackup: { type: Date },
  nextBackup: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const AutoBackup = mongoose.models.AutoBackup || mongoose.model('AutoBackup', AutoBackupSchema);

// Aktif cron işleri
const activeJobs = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('otoyedekle')
    .setDescription('Otomatik yedekleme ayarlarını yönetir')
    .addSubcommand(subcommand =>
      subcommand
        .setName('başlat')
        .setDescription('Otomatik yedeklemeyi başlatır')
        .addStringOption(option =>
          option.setName('aralık')
            .setDescription('Yedekleme aralığı')
            .setRequired(true)
            .addChoices(
              { name: 'Günlük', value: 'daily' },
              { name: 'Haftalık', value: 'weekly' },
              { name: 'Aylık', value: 'monthly' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('durdur')
        .setDescription('Otomatik yedeklemeyi durdurur'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('durum')
        .setDescription('Otomatik yedekleme durumunu gösterir'))
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

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    try {
      // Başlat komutu
      if (subcommand === 'başlat') {
        const interval = interaction.options.getString('aralık');
        
        // Cron ifadesi oluştur
        let cronExpression;
        let nextBackupDate;
        let intervalText;
        
        const now = new Date();
        
        switch (interval) {
          case 'daily':
            // Her gün gece yarısı
            cronExpression = '0 0 * * *';
            nextBackupDate = new Date(now);
            nextBackupDate.setDate(nextBackupDate.getDate() + 1);
            nextBackupDate.setHours(0, 0, 0, 0);
            intervalText = 'günlük';
            break;
          case 'weekly':
            // Her Pazartesi gece yarısı
            cronExpression = '0 0 * * 1';
            nextBackupDate = new Date(now);
            const daysUntilMonday = 1 - now.getDay();
            const daysToAdd = daysUntilMonday <= 0 ? daysUntilMonday + 7 : daysUntilMonday;
            nextBackupDate.setDate(nextBackupDate.getDate() + daysToAdd);
            nextBackupDate.setHours(0, 0, 0, 0);
            intervalText = 'haftalık';
            break;
          case 'monthly':
            // Her ayın ilk günü gece yarısı
            cronExpression = '0 0 1 * *';
            nextBackupDate = new Date(now);
            nextBackupDate.setMonth(nextBackupDate.getMonth() + 1);
            nextBackupDate.setDate(1);
            nextBackupDate.setHours(0, 0, 0, 0);
            intervalText = 'aylık';
            break;
          default:
            return interaction.editReply({
              content: '❌ Geçersiz yedekleme aralığı seçildi.'
            });
        }
        
        // Veritabanında ayarları güncelle veya oluştur
        let autoBackup = await AutoBackup.findOne({ guildId });
        
        if (autoBackup) {
          autoBackup.enabled = true;
          autoBackup.interval = interval;
          autoBackup.nextBackup = nextBackupDate;
          autoBackup.updatedAt = new Date();
        } else {
          autoBackup = new AutoBackup({
            guildId,
            enabled: true,
            interval,
            nextBackup: nextBackupDate
          });
        }
        
        await autoBackup.save();
        
        // Varolan cron işini durdur ve yenisini başlat
        if (activeJobs.has(guildId)) {
          activeJobs.get(guildId).stop();
        }
        
        // Yedekleme fonksiyonu
        const backupFunction = async () => {
          try {
            console.log(`Otomatik yedekleme çalışıyor: ${guildName} (${guildId})`);
            
            // Sunucu üyelerini al
            const guild = await client.guilds.fetch(guildId);
            const members = await guild.members.fetch();
            
            // Kullanıcı listesi oluştur
            const authorizedUsers = [];
            
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
            }
            
            // Backup oluştur
            const backup = new Backup({
              guildId: guild.id,
              guildName: guild.name,
              users: authorizedUsers
            });
            
            await backup.save();
            
            // AutoBackup kaydını güncelle
            const autoBackupRecord = await AutoBackup.findOne({ guildId });
            
            if (autoBackupRecord) {
              autoBackupRecord.lastBackup = new Date();
              
              // Bir sonraki yedekleme zamanını hesapla
              const nextBackup = new Date();
              
              switch (autoBackupRecord.interval) {
                case 'daily':
                  nextBackup.setDate(nextBackup.getDate() + 1);
                  break;
                case 'weekly':
                  nextBackup.setDate(nextBackup.getDate() + 7);
                  break;
                case 'monthly':
                  nextBackup.setMonth(nextBackup.getMonth() + 1);
                  break;
              }
              
              autoBackupRecord.nextBackup = nextBackup;
              autoBackupRecord.updatedAt = new Date();
              await autoBackupRecord.save();
            }
            
            console.log(`Otomatik yedekleme tamamlandı: ${guild.name} (${guildId}) - ${authorizedUsers.length} kullanıcı`);
          } catch (error) {
            console.error(`Otomatik yedekleme hatası (${guildId}):`, error);
          }
        };
        
        // Yeni cron işi oluştur
        const job = cron.schedule(cronExpression, backupFunction);
        activeJobs.set(guildId, job);
        
        // Bilgilendirme mesajı gönder
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Otomatik Yedekleme Başlatıldı')
          .setDescription(`**${guildName}** sunucusu için otomatik yedekleme başarıyla ayarlandı.`)
          .addFields(
            { name: '⏰ Yedekleme Aralığı', value: `${intervalText.charAt(0).toUpperCase() + intervalText.slice(1)}` },
            { name: '📅 Bir Sonraki Yedekleme', value: `<t:${Math.floor(nextBackupDate.getTime() / 1000)}:F>` }
          )
          .setTimestamp()
          .setFooter({ text: `${interaction.user.tag} tarafından ayarlandı`, iconURL: interaction.user.displayAvatarURL() });
        
        await interaction.editReply({ embeds: [embed] });
        
      } else if (subcommand === 'durdur') {
        // Veritabanında ayarları güncelle
        const autoBackup = await AutoBackup.findOne({ guildId });
        
        if (!autoBackup || !autoBackup.enabled) {
          return interaction.editReply({
            content: '❌ Bu sunucu için otomatik yedekleme zaten devre dışı.'
          });
        }
        
        autoBackup.enabled = false;
        autoBackup.updatedAt = new Date();
        await autoBackup.save();
        
        // Varolan cron işini durdur
        if (activeJobs.has(guildId)) {
          activeJobs.get(guildId).stop();
          activeJobs.delete(guildId);
        }
        
        // Bilgilendirme mesajı gönder
        const embed = new EmbedBuilder()
          .setColor(0xFF5733)
          .setTitle('🛑 Otomatik Yedekleme Durduruldu')
          .setDescription(`**${guildName}** sunucusu için otomatik yedekleme devre dışı bırakıldı.`)
          .setTimestamp()
          .setFooter({ text: `${interaction.user.tag} tarafından durduruldu`, iconURL: interaction.user.displayAvatarURL() });
        
        await interaction.editReply({ embeds: [embed] });
        
      } else if (subcommand === 'durum') {
        // Ayarları getir
        const autoBackup = await AutoBackup.findOne({ guildId });
        
        if (!autoBackup) {
          return interaction.editReply({
            content: '❌ Bu sunucu için otomatik yedekleme henüz ayarlanmamış.'
          });
        }
        
        // Son yedekleme sayısını al
        const backupCount = await Backup.countDocuments({ guildId });
        
        // Aralık metnini belirle
        let intervalText;
        switch (autoBackup.interval) {
          case 'daily':
            intervalText = 'Günlük';
            break;
          case 'weekly':
            intervalText = 'Haftalık';
            break;
          case 'monthly':
            intervalText = 'Aylık';
            break;
          default:
            intervalText = 'Bilinmiyor';
        }
        
        // Bilgilendirme mesajı gönder
        const embed = new EmbedBuilder()
          .setColor(autoBackup.enabled ? 0x00FF00 : 0xFF5733)
          .setTitle('📊 Otomatik Yedekleme Durumu')
          .setDescription(`**${guildName}** sunucusu için otomatik yedekleme durumu`)
          .addFields(
            { name: '⚙️ Durum', value: autoBackup.enabled ? '✅ Aktif' : '🛑 Devre Dışı' },
            { name: '⏰ Yedekleme Aralığı', value: intervalText }
          )
          .setTimestamp()
          .setFooter({ text: `${interaction.user.tag} tarafından sorgulandı`, iconURL: interaction.user.displayAvatarURL() });
        
        if (autoBackup.lastBackup) {
          embed.addFields({
            name: '🕒 Son Yedekleme',
            value: `<t:${Math.floor(autoBackup.lastBackup.getTime() / 1000)}:F>`
          });
        }
        
        if (autoBackup.enabled && autoBackup.nextBackup) {
          embed.addFields({
            name: '📅 Bir Sonraki Yedekleme',
            value: `<t:${Math.floor(autoBackup.nextBackup.getTime() / 1000)}:F>`
          });
        }
        
        embed.addFields({
          name: '📦 Toplam Yedek',
          value: `${backupCount} yedek bulundu`
        });
        
        await interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Otomatik yedekleme komut hatası:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Hata Oluştu')
        .setDescription('Otomatik yedekleme komutu çalıştırılırken bir hata oluştu.')
        .addFields({ name: 'Hata Detayı', value: `\`\`\`${error.message}\`\`\`` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}; 