const { Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

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

// UserToken şeması (mevcut şemayı kullan)
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

// Özel sunucu ID'leri
const SPECIFIC_GUILD_ID = '1364256764018556989';
const REWARDS_GUILD_ID = '1368180792089640970';

// Guild-specific komutları belirle
let guildCommandNames = [];
let rewardsCommandNames = [];

try {
    // Guilds komutlarını yükle
    const guildsCommandsPath = path.join(__dirname, '..', 'commands', 'guilds');
    if (fs.existsSync(guildsCommandsPath)) {
        const guildCommandFiles = fs.readdirSync(guildsCommandsPath).filter(file => file.endsWith('.js'));
        guildCommandNames = guildCommandFiles.map(file => {
            const command = require(path.join(guildsCommandsPath, file));
            return command.data?.name;
        }).filter(Boolean);
    }
    
    // Rewards komutlarını yükle
    const rewardsCommandsPath = path.join(__dirname, '..', 'commands', 'rewards');
    if (fs.existsSync(rewardsCommandsPath)) {
        const rewardsCommandFiles = fs.readdirSync(rewardsCommandsPath).filter(file => file.endsWith('.js'));
        rewardsCommandNames = rewardsCommandFiles.map(file => {
            const command = require(path.join(rewardsCommandsPath, file));
            return command.data?.name;
        }).filter(Boolean);
    }
} catch (error) {
    console.error('Komut listelerini yüklerken hata:', error);
}

// Ticket komut ve buton işleyicisini yükle
let ticketCommand;
try {
    const ticketCommandPath = path.join(__dirname, '..', 'commands', 'rewards', 'ticket.js');
    if (fs.existsSync(ticketCommandPath)) {
        ticketCommand = require(ticketCommandPath);
    }
} catch (error) {
    console.error('Ticket komutu yüklenirken hata:', error);
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, config) {
        // Button interactions
        if (interaction.isButton()) {
            // Doğrulama butonu kontrolü
            if (interaction.customId === 'verify') {
                await handleVerification(interaction, client, config);
                return;
            }
            
            // Detay butonu kontrolü
            if (interaction.customId.startsWith('detay_')) {
                // Bu buton paylasim.js içinde işleniyor, burada özel bir işlem gerekmiyor
                return;
            }
            
            // Ticket buton kontrolleri
            const ticketButtonIds = ['create_ticket', 'close_ticket', 'delete_ticket'];
            if (ticketButtonIds.includes(interaction.customId) && ticketCommand) {
                try {
                    await ticketCommand.handleInteraction(interaction, client, config);
                    return;
                } catch (error) {
                    console.error('Ticket buton işleme hatası:', error);
                    await interaction.reply({ 
                        content: 'Ticket işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.', 
                        ephemeral: true 
                    }).catch(console.error);
                    return;
                }
            }
        }
        
        // Modal submit interactions
        if (interaction.isModalSubmit()) {
            // Ticket modal kontrolleri
            if (interaction.customId === 'ticket_modal' && ticketCommand) {
                try {
                    await ticketCommand.handleInteraction(interaction, client, config);
                    return;
                } catch (error) {
                    console.error('Ticket modal işleme hatası:', error);
                    await interaction.reply({ 
                        content: 'Ticket oluşturma sırasında bir hata oluştu. Lütfen tekrar deneyin.', 
                        ephemeral: true 
                    }).catch(console.error);
                    return;
                }
            }
        }
        
        // Command interactions
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`${interaction.commandName} komutu bulunamadı.`);
                return;
            }
            
            // Sunucu komutu filtrelemesi - Guild-specific komutlar sadece belirli sunucuda çalışabilir
            const isGuildCommand = guildCommandNames.includes(interaction.commandName);
            if (isGuildCommand && interaction.guildId !== SPECIFIC_GUILD_ID) {
                return await interaction.reply({ 
                    content: 'Bu komut sadece belirli bir sunucuda kullanılabilir.', 
                    ephemeral: true 
                });
            }
            
            // Rewards sunucu komutu filtrelemesi - Rewards-specific komutlar sadece rewards sunucusunda çalışabilir
            const isRewardsCommand = rewardsCommandNames.includes(interaction.commandName);
            if (isRewardsCommand && interaction.guildId !== REWARDS_GUILD_ID) {
                return await interaction.reply({ 
                    content: 'Bu komut sadece Rewards sunucusunda kullanılabilir.', 
                    ephemeral: true 
                });
            }
            
            try {
                await command.execute(interaction, client, client.tokenService);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                
                const errorResponse = { 
                    content: 'Bu komutu çalıştırırken bir hata oluştu!', 
                    ephemeral: true 
                };
                
                try {
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp(errorResponse);
                    } else {
                        await interaction.reply(errorResponse);
                    }
                } catch (followUpError) {
                    // İkinci bir hata oluşursa sadece log'a kaydet, çökmeyi önle
                    console.error('Hata mesajı gönderilemedi:', followUpError);
                }
            }
        }
    },
};

// Doğrulama işleyicisi
async function handleVerification(interaction, client, config) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        // MongoDB'den kullanıcı kontrolü
        const userToken = await UserToken.findOne({ userId });
        
        // Kullanıcı yoksa
        if (!userToken) {
            return interaction.editReply({
                content: `❌ Sistemde kaydınız bulunamadı. Lütfen önce https://auth2-bot.vercel.app/ adresinden hesabınızı doğrulayın.`,
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 5,
                                label: 'Doğrulama Sayfası',
                                url: 'https://auth2-bot.vercel.app/'
                            }
                        ]
                    }
                ]
            });
        }
        
        // Ayarları kontrol et
        const settings = await GuildSettings.findOne({ guildId });
        
        if (!settings) {
            return interaction.editReply({
                content: '❌ Bu sunucu için doğrulama ayarları yapılmamış. Lütfen bir yöneticiye danışın.'
            });
        }
        
        // Kullanıcıya rol ver
        if (settings.verificationRoleId) {
            try {
                const member = interaction.member;
                await member.roles.add(settings.verificationRoleId);
            } catch (error) {
                console.error('Rol verme hatası:', error);
                return interaction.editReply({
                    content: '❌ Rol verme işlemi sırasında bir hata oluştu. Lütfen yöneticilerin bot rolünü kontrol etmesini isteyin.'
                });
            }
        }
        
        // Log kanalına bilgi gönder
        if (settings.logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(settings.logChannelId);
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Kullanıcı Doğrulandı')
                    .setDescription(`<@${userId}> (${interaction.user.tag}) başarıyla doğrulandı.`)
                    .setTimestamp()
                    .setFooter({ text: 'Rewards Doğrulama Sistemi', iconURL: client.user.displayAvatarURL() });
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
        
        // DM bildirimi gönder (Eğer config'de etkinleştirilmişse)
        try {
            // Config'den enableDMNotification ayarını kontrol et, varsayılan olarak true
            const enableDMNotification = config?.verification?.enableDMNotification !== false;
            
            if (enableDMNotification) {
                const user = await client.users.fetch(userId);
                if (user) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(`✅ ${interaction.guild.name} Sunucusunda Doğrulandınız`)
                        .setDescription(config?.verification?.successMessage || "Hesabınız başarıyla doğrulandı! Artık sunucumuza erişebilirsiniz.")
                        .setTimestamp()
                        .setFooter({ text: 'Rewards Doğrulama Sistemi', iconURL: client.user.displayAvatarURL() });
                    
                    await user.send({ embeds: [dmEmbed] }).catch(error => {
                        console.log(`DM gönderme hatası: ${userId} kullanıcısına mesaj gönderilemedi. DM'leri kapalı olabilir.`);
                    });
                }
            }
        } catch (dmError) {
            console.error('DM gönderme hatası:', dmError);
            // DM gönderme hatası kritik değil, işleme devam et
        }
        
        // Kullanıcıya başarılı mesajı gönder
        return interaction.editReply({
            content: `✅ Başarıyla doğrulandınız! ${settings.verificationRoleId ? `<@&${settings.verificationRoleId}> rolü size verildi.` : ''}`
        });
        
    } catch (error) {
        console.error('Doğrulama hatası:', error);
        return interaction.editReply({
            content: '❌ Doğrulama işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        });
    }
} 
