const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('paylasim')
        .setDescription('Yeni bir paylaşım kanalı ve içeriği oluşturur')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, client) {
        // Modal oluşturma
        const modal = new ModalBuilder()
            .setCustomId('paylasimModal')
            .setTitle('Yeni Paylaşım Oluştur');

        // Kanal adı girişi
        const kanalAdiInput = new TextInputBuilder()
            .setCustomId('kanalAdi')
            .setLabel('Kanal Adı')
            .setPlaceholder('Oluşturulacak kanalın adını girin')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // İçerik girişi
        const icerikInput = new TextInputBuilder()
            .setCustomId('icerik')
            .setLabel('İçerik')
            .setPlaceholder('Paylaşılacak içeriği girin')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Input alanlarını modal'a ekle
        const kanalAdiRow = new ActionRowBuilder().addComponents(kanalAdiInput);
        const icerikRow = new ActionRowBuilder().addComponents(icerikInput);
        modal.addComponents(kanalAdiRow, icerikRow);

        // Modal'ı göster
        await interaction.showModal(modal);

        // Modal yanıtını bekle
        const filter = (i) => i.customId === 'paylasimModal' && i.user.id === interaction.user.id;
        
        try {
            const modalSubmit = await interaction.awaitModalSubmit({ filter, time: 60000 });
            
            // Form verilerini al
            const kanalAdi = modalSubmit.fields.getTextInputValue('kanalAdi');
            const icerik = modalSubmit.fields.getTextInputValue('icerik');
            
            await modalSubmit.deferReply({ ephemeral: true });
            
            // Kategori ID'si
            const KATEGORI_ID = '1368191069178691694';
            
            try {
                // Kategoriyi kontrol et
                const kategori = await interaction.guild.channels.fetch(KATEGORI_ID);
                if (!kategori) {
                    return modalSubmit.editReply({ content: '❌ Belirtilen kategori bulunamadı!', ephemeral: true });
                }
                
                // Yeni kanal oluştur
                const yeniKanal = await interaction.guild.channels.create({
                    name: kanalAdi,
                    type: 0, // 0 = Metin kanalı
                    parent: KATEGORI_ID,
                    reason: `${interaction.user.tag} tarafından oluşturuldu`
                });
                
                // İçeriğin ilk 50 karakteri
                const kisaIcerik = icerik.length > 50 ? icerik.substring(0, 50) + '...' : icerik;
                
                // Embed oluştur
                const paylasilanEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${kanalAdi} Paylaşımı`)
                    .setDescription(kisaIcerik)
                    .addFields(
                        { name: 'Paylaşan', value: `<@${interaction.user.id}>` },
                        { name: 'Tarih', value: new Date().toLocaleDateString('tr-TR') }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Rewards Paylaşım Sistemi', iconURL: client.user.displayAvatarURL() });
                
                // Buton oluştur
                const detayButon = new ButtonBuilder()
                    .setCustomId(`detay_${Date.now()}`)
                    .setLabel('Detayları Göster')
                    .setStyle(ButtonStyle.Primary);
                
                const row = new ActionRowBuilder().addComponents(detayButon);
                
                // Embedli mesajı kanala gönder
                const paylasilanMesaj = await yeniKanal.send({
                    embeds: [paylasilanEmbed],
                    components: [row]
                });
                
                // Onaylı rollerin ID'leri
                // Bu ID'leri güncelleyin (rol ID'lerini yazın)
                const onayliRoller = [
                    '1368191280840048640'  // Örnek rol ID 3
                ];
                
                // Buton tıklama olayı
                const butonFilter = i => i.customId.startsWith('detay_') && i.message.id === paylasilanMesaj.id;
                const collector = yeniKanal.createMessageComponentCollector({ filter: butonFilter });
                
                collector.on('collect', async i => {
                    // Kullanıcının rollerini kontrol et
                    const member = i.member;
                    const userHasRequiredRole = member.roles.cache.some(role => onayliRoller.includes(role.id));
                    
                    // Eğer gerekli rollerden hiçbirine sahip değilse
                    if (!userHasRequiredRole) {
                        return i.reply({
                            content: '⛔ Bu detayları görüntülemek için gerekli role sahip değilsiniz.',
                            ephemeral: true
                        });
                    }
                    
                    // İçeriği göster (ephemeral olarak)
                    await i.reply({
                        content: `**${kanalAdi} Detayları:**\n\n${icerik.substring(0, 1900)}${icerik.length > 1900 ? '...' : ''}`,
                        ephemeral: true
                    });
                });
                
                // Kullanıcıya bilgi ver
                await modalSubmit.editReply({
                    content: `✅ Paylaşım başarıyla oluşturuldu! Kanal: <#${yeniKanal.id}>\n\n**Not:** Detayları sadece onaylı rollere sahip üyeler görüntüleyebilir.`,
                    ephemeral: true
                });
                
            } catch (error) {
                console.error('Kanal oluşturma hatası:', error);
                await modalSubmit.editReply({
                    content: '❌ Kanal oluşturulurken bir hata oluştu! Hata: ' + error.message,
                    ephemeral: true
                });
            }
            
        } catch (error) {
            console.error('Modal işleme hatası:', error);
            if (error.code === 'InteractionCollectorError') {
                await interaction.followUp({
                    content: '❌ Form doldurma süresi doldu!',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    },
}; 