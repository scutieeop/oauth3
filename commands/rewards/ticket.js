const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const mongoose = require('mongoose');

// Ticket şema ve modeli
const TicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  subject: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
});

// Mongoose model oluştur veya varsa kullan
const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket sistemi ile ilgili komutlar')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('kur')
        .setDescription('Ticket sistemini kurar')
        .addChannelOption(option => 
          option.setName('kanal')
            .setDescription('Ticket mesajının gönderileceği kanal')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kapat')
        .setDescription('Mevcut ticket\'ı kapatır')
    ),

  async execute(interaction, client, config) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'kur') {
      // Yetkisi var mı kontrol et
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız.', ephemeral: true });
      }
      
      const channel = interaction.options.getChannel('kanal');
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket Sistemi')
        .setDescription('Destek almak için aşağıdaki butona tıklayarak bir ticket oluşturabilirsiniz.')
        .setColor('#7289da')
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });
      
      // Buton oluştur
      const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Ticket Oluştur')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫');
      
      const row = new ActionRowBuilder().addComponents(button);
      
      // Kanala gönder
      await channel.send({ embeds: [embed], components: [row] });
      
      return interaction.reply({ content: `Ticket sistemi ${channel} kanalında başarıyla kuruldu!`, ephemeral: true });
    } 
    else if (subcommand === 'kapat') {
      // Ticket kanalı mı kontrol et
      const ticketData = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
      
      if (!ticketData) {
        return interaction.reply({ content: 'Bu komut sadece ticket kanallarında kullanılabilir.', ephemeral: true });
      }
      
      // Ticket'ı kapat
      await Ticket.updateOne(
        { channelId: interaction.channelId },
        { $set: { status: 'closed', closedAt: new Date() } }
      );
      
      // Embed oluştur
      const embed = new EmbedBuilder()
        .setTitle('Ticket Kapatıldı')
        .setDescription(`Bu ticket <@${interaction.user.id}> tarafından kapatıldı.`)
        .setColor('#ff0000')
        .setTimestamp();
      
      // Butonlar
      const deleteButton = new ButtonBuilder()
        .setCustomId('delete_ticket')
        .setLabel('Ticket\'ı Sil')
        .setStyle(ButtonStyle.Danger);
      
      const row = new ActionRowBuilder().addComponents(deleteButton);
      
      return interaction.reply({ embeds: [embed], components: [row] });
    }
  },
  
  // Modal ve buton işleme
  async handleInteraction(interaction, client, config) {
    if (interaction.isButton()) {
      if (interaction.customId === 'create_ticket') {
        // Modal oluştur
        const modal = new ModalBuilder()
          .setCustomId('ticket_modal')
          .setTitle('Ticket Oluştur');
        
        // Konu input alanı
        const subjectInput = new TextInputBuilder()
          .setCustomId('ticket_subject')
          .setLabel('Konu')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ticket konusunu kısaca belirtin')
          .setRequired(true)
          .setMaxLength(100);
        
        // Açıklama input alanı
        const descriptionInput = new TextInputBuilder()
          .setCustomId('ticket_description')
          .setLabel('Açıklama')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Sorununuzu veya talebinizi detaylı açıklayın')
          .setRequired(true)
          .setMaxLength(1000);
        
        const subjectRow = new ActionRowBuilder().addComponents(subjectInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
        
        modal.addComponents(subjectRow, descriptionRow);
        
        await interaction.showModal(modal);
      } 
      else if (interaction.customId === 'close_ticket') {
        // Ticket kanalı mı kontrol et
        const ticketData = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
        
        if (!ticketData) {
          return interaction.reply({ content: 'Bu ticket zaten kapatılmış veya bulunamıyor.', ephemeral: true });
        }
        
        // Ticket'ı kapat
        await Ticket.updateOne(
          { channelId: interaction.channelId },
          { $set: { status: 'closed', closedAt: new Date() } }
        );
        
        // Embed oluştur
        const embed = new EmbedBuilder()
          .setTitle('Ticket Kapatıldı')
          .setDescription(`Bu ticket <@${interaction.user.id}> tarafından kapatıldı.`)
          .setColor('#ff0000')
          .setTimestamp();
        
        // Butonlar
        const deleteButton = new ButtonBuilder()
          .setCustomId('delete_ticket')
          .setLabel('Ticket\'ı Sil')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(deleteButton);
        
        return interaction.reply({ embeds: [embed], components: [row] });
      }
      else if (interaction.customId === 'delete_ticket') {
        const ticketData = await Ticket.findOne({ channelId: interaction.channelId });
        
        if (!ticketData) {
          return interaction.reply({ content: 'Bu ticket zaten silinmiş veya bulunamıyor.', ephemeral: true });
        }
        
        // Ticket kanalını sil
        await interaction.reply({ content: 'Ticket kanalı 5 saniye içinde silinecek...' });
        
        setTimeout(async () => {
          try {
            const channel = interaction.guild.channels.cache.get(interaction.channelId);
            if (channel) await channel.delete();
          } catch (error) {
            console.error('Ticket kanalı silinirken hata:', error);
          }
        }, 5000);
      }
    } 
    else if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
      // Modal verilerini al
      const subject = interaction.fields.getTextInputValue('ticket_subject');
      const description = interaction.fields.getTextInputValue('ticket_description');
      
      // Tekrar ticket açmayı önle
      const existingTicket = await Ticket.findOne({ 
        userId: interaction.user.id,
        guildId: interaction.guildId,
        status: 'open'
      });
      
      if (existingTicket) {
        const ticketChannel = interaction.guild.channels.cache.get(existingTicket.channelId);
        if (ticketChannel) {
          return interaction.reply({ 
            content: `Zaten açık bir ticket'ınız var: ${ticketChannel}`,
            ephemeral: true 
          });
        }
      }
      
      // Yeni ticket kanalı oluştur
      const ticketId = Math.floor(1000 + Math.random() * 9000);
      const channelName = `ticket-${interaction.user.username.toLowerCase()}-${ticketId}`;
      
      try {
        // Ticket kategorisini bul veya oluştur
        let category = interaction.guild.channels.cache.find(c => 
          c.type === ChannelType.GuildCategory && c.name === 'Tickets');
        
        if (!category) {
          category = await interaction.guild.channels.create({
            name: 'Tickets',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
        }
        
        // Ticket kanalını oluştur
        const channel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            }
          ]
        });
        
        // Veritabanına kaydet
        const newTicket = new Ticket({
          ticketId: ticketId.toString(),
          userId: interaction.user.id,
          channelId: channel.id,
          guildId: interaction.guildId,
          subject: subject,
          status: 'open'
        });
        
        await newTicket.save();
        
        // Embed ve butonları oluştur
        const embed = new EmbedBuilder()
          .setTitle(`Ticket #${ticketId}: ${subject}`)
          .setDescription(`**Açıklama:** ${description}\n\n**Kullanıcı:** <@${interaction.user.id}>`)
          .setColor('#7289da')
          .setTimestamp()
          .setFooter({ text: `Ticket ID: ${ticketId}` });
        
        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Ticket\'ı Kapat')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(closeButton);
        
        await channel.send({ embeds: [embed], components: [row] });
        await channel.send({ content: `<@${interaction.user.id}> ticket'ınız oluşturuldu!` });
        
        return interaction.reply({ 
          content: `Ticket'ınız başarıyla oluşturuldu: ${channel}`,
          ephemeral: true 
        });
      } catch (error) {
        console.error('Ticket oluşturulurken hata:', error);
        return interaction.reply({ 
          content: 'Ticket oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
          ephemeral: true 
        });
      }
    }
  }
}; 
