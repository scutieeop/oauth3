const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sunucular')
    .setDescription('Botun ekli olduğu sunucuları listeler')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client, tokenService) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      // Sadece bot sahibi bu komutu kullanabilsin (config içerisindeki ownerId ile kontrol)
      const configModule = require('../../config.json');
      const isBotOwner = interaction.user.id === configModule.bot.ownerId;
      
      if (!isBotOwner) {
        return interaction.editReply({ 
          content: '⛔ Bu komutu yalnızca bot sahibi kullanabilir.',
          ephemeral: true 
        });
      }
      
      // Bot sunucularını getir
      const guilds = client.guilds.cache;
      
      if (guilds.size === 0) {
        return interaction.editReply({
          content: 'Bot hiçbir sunucuya eklenmemiş.',
          ephemeral: true
        });
      }
      
      // Sunucuları düzenle ve bilgilerini al
      const guildList = guilds.map(guild => {
        return {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          icon: guild.iconURL({ dynamic: true }),
          createdAt: guild.createdAt,
          joinedAt: guild.joinedAt
        };
      }).sort((a, b) => b.memberCount - a.memberCount); // Üye sayısına göre sırala
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🌐 Sunucu Listesi')
        .setDescription(`Bot şu anda **${guilds.size}** sunucuda çalışıyor.`)
        .setTimestamp()
        .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() });
      
      // Her 10 sunucuyu bir alan olarak ekle (Discord limite sahip)
      const chunks = [];
      for (let i = 0; i < guildList.length; i += 10) {
        chunks.push(guildList.slice(i, i + 10));
      }
      
      // En fazla 5 alan ekle (Discord limite sahip)
      const maxFields = Math.min(chunks.length, 5);
      
      for (let i = 0; i < maxFields; i++) {
        const chunk = chunks[i];
        let fieldValue = '';
        
        chunk.forEach((guild, index) => {
          const joinedDate = new Date(guild.joinedAt).toLocaleDateString('tr-TR');
          fieldValue += `**${index + 1 + (i * 10)}.** ${guild.name}\n`;
          fieldValue += `└ ID: \`${guild.id}\` | Üyeler: **${guild.memberCount}** | Katılım: **${joinedDate}**\n`;
        });
        
        embed.addFields({
          name: `Sunucu Listesi - Sayfa ${i + 1}/${maxFields}`,
          value: fieldValue || 'Sunucu yok',
        });
      }
      
      if (guildList.length > 50) {
        embed.addFields({
          name: '⚠️ Not',
          value: `Toplam ${guildList.length} sunucudan sadece ilk 50 tanesi gösteriliyor.`
        });
      }
      
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Sunucu listeleme hatası:', error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Sunucular listelenirken bir hata oluştu.');
      } else {
        await interaction.reply({ content: 'Sunucular listelenirken bir hata oluştu.', ephemeral: true });
      }
    }
  },
}; 