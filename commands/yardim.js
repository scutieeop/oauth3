const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Auth2Bot hakkında bilgi ve komutların listesini gösterir'),
    
    async execute(interaction, client, tokenService) {
        try {
            await interaction.deferReply({ ephemeral: false });
            
            // Config dosyasını yükle
            const config = require('../config.json');
            
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Rewards! Auth2Bot Yardım v1.1')
                .setDescription('Discord kullanıcılarının OAuth2 ile yetkilendirme yapmasını ve bu şekilde onceki sunucularda yaptıklari uygunsuz eylemleri onlemenmesini sağlar.')
                .addFields(
                    {
                        name: '📚 Temel Komutlar',
                        value: `
                        🔹 **/auth2link** - OAuth2 yetkilendirme linki oluşturur
                        🔹 **/yardim** - Bu yardım mesajını gösterir
                        `
                    },
                   {
                        name: '🔒 Doğrulama Sistemi',
                        value: `
                        🔹 **/doğrulamalog** - Doğrulama için log kanalını ayarlar
                        🔹 **/doğrulamarol** - Doğrulanan kullanıcılara verilecek rolü ayarlar
                        🔹 **/doğrulamamesaj** - DM üzerinden gönderilecek mesajı ayarlar
                        🔹 **/doğrulamabuttonkanal** - Doğrulama butonu için kanalı ayarlar
                        🔹 **/doğrulamadurum** - Doğrulama sistemi ayarlarını gösterir
                        `
                    },
                    {
                        name: '⚙️ Sistem Komutları',
                        value: `
                        🔹 **/sunucular** - Botun ekli olduğu sunucuları listeler (sadece bot sahibi)
                        `
                    },
                    
                );
                
           
            
            // OAuth2 doğrulama sayfası bilgisi ekle
            embed.addFields({
                name: '🔗 Doğrulama Sayfası',
                value: `Kullanıcılar [https://auth2-bot.vercel.app/](https://auth2-bot.vercel.app/) adresinden hesaplarını doğrulayabilirler.`
            });
            
            embed.addFields({
                name: '📋 Yenilikler (v1.0)',
                value: `
                ✨ Hata yönetimi ve daha detaylı bilgi
                `
            })
            .setFooter({ text: `Discord Rewards Auth2Bot v1.0 • ${interaction.user.tag} tarafından istendi`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
            
            await interaction.editReply({
                embeds: [embed]
            });
            
        } catch (error) {
            console.error('Yardım komutu hatası:', error);
            
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply('Yardım bilgisi gösterilirken bir hata oluştu.');
                } else {
                    await interaction.reply('Yardım bilgisi gösterilirken bir hata oluştu.');
                }
            } catch (followUpError) {
                console.error('Hata mesajı gönderme hatası:', followUpError);
            }
        }
    },
}; 