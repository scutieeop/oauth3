const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client, _client, config) {
        console.log(`Hazır! ${client.user.tag} olarak giriş yapıldı`);
        console.log(`Bot ${client.guilds.cache.size} sunucuya hizmet veriyor`);
    },
}; 