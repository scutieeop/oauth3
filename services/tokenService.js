const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Global config değişkeni
let config = null;

/**
 * Config nesnesini ayarla
 * @param {Object} configObj - Config nesnesi
 */
function setConfig(configObj) {
    config = configObj;
}

// Token verilerini saklayacağımız klasör
function getTokensDir() {
    const STORAGE_DIR = config ? config.storage.dir : './storage';
    const TOKENS_DIR = path.join(__dirname, '..', STORAGE_DIR, 'tokens');
    
    // Token klasörünün varlığını kontrol et ve yoksa oluştur
    if (!fs.existsSync(TOKENS_DIR)) {
        fs.mkdirSync(TOKENS_DIR, { recursive: true });
    }
    
    return TOKENS_DIR;
}

/**
 * Kullanıcının token bilgilerini getir
 * @param {string} userId - Discord kullanıcı ID'si
 * @returns {Object|null} - Token bilgileri veya null
 */
function getUserToken(userId) {
    const tokenPath = path.join(getTokensDir(), `${userId}.json`);
    
    if (!fs.existsSync(tokenPath)) {
        return null;
    }
    
    try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        return tokenData;
    } catch (error) {
        console.error(`Token okuma hatası (${userId}):`, error);
        return null;
    }
}

/**
 * Tüm yetkilendirilmiş kullanıcıları getir
 * @returns {Array} - Kullanıcı token bilgileri dizisi
 */
function getAllAuthorizedUsers() {
    try {
        const TOKENS_DIR = getTokensDir();
        const files = fs.readdirSync(TOKENS_DIR).filter(file => file.endsWith('.json'));
        const users = [];
        
        for (const file of files) {
            try {
                const userId = file.replace('.json', '');
                const userData = getUserToken(userId);
                
                if (userData) {
                    users.push({
                        id: userData.id,
                        username: userData.username,
                        authorized: true,
                        expires_at: userData.expires_at
                    });
                }
            } catch (error) {
                console.error(`Kullanıcı verisi okuma hatası (${file}):`, error);
            }
        }
        
        return users;
    } catch (error) {
        console.error('Yetkilendirilmiş kullanıcıları getirme hatası:', error);
        return [];
    }
}

/**
 * Token'ın geçerli olup olmadığını kontrol et
 * @param {Object} tokenData - Token verisi
 * @returns {boolean} - Token geçerli mi?
 */
function isTokenValid(tokenData) {
    if (!tokenData || !tokenData.expires_at) {
        return false;
    }
    
    // Geçerlilik süresinin dolmasına 5 dakika kalmış mı kontrol et
    const fiveMinutesInMs = 5 * 60 * 1000;
    return Date.now() < (tokenData.expires_at - fiveMinutesInMs);
}

/**
 * Refresh token kullanarak access token'ı yenile
 * @param {string} userId - Discord kullanıcı ID'si
 * @returns {Promise<Object|null>} - Yeni token verisi veya null
 */
async function refreshUserToken(userId) {
    if (!config) {
        console.error('Config nesnesi ayarlanmadı. setConfig() çağrılmalı.');
        return null;
    }
    
    const tokenData = getUserToken(userId);
    
    if (!tokenData || !tokenData.refresh_token) {
        return null;
    }
    
    try {
        const response = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: config.bot.clientId,
                client_secret: config.bot.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: tokenData.refresh_token
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const { access_token, refresh_token, expires_in } = response.data;
        
        // Token verilerini güncelle
        const updatedTokenData = {
            ...tokenData,
            access_token,
            refresh_token: refresh_token || tokenData.refresh_token,
            expires_at: Date.now() + expires_in * 1000
        };
        
        // Dosyaya kaydet
        fs.writeFileSync(
            path.join(getTokensDir(), `${userId}.json`),
            JSON.stringify(updatedTokenData, null, 2)
        );
        
        return updatedTokenData;
    } catch (error) {
        console.error(`Token yenileme hatası (${userId}):`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Kullanıcının geçerli bir access token'ını getir. Gerekirse yenile.
 * @param {string} userId - Discord kullanıcı ID'si
 * @returns {Promise<string|null>} - Geçerli access token veya null
 */
async function getValidAccessToken(userId) {
    let tokenData = getUserToken(userId);
    
    // Token bulunamadı
    if (!tokenData) {
        return null;
    }
    
    // Token süresi geçmişse yenile
    if (!isTokenValid(tokenData)) {
        tokenData = await refreshUserToken(userId);
        
        if (!tokenData) {
            return null;
        }
    }
    
    return tokenData.access_token;
}

module.exports = {
    setConfig,
    getUserToken,
    getAllAuthorizedUsers,
    isTokenValid,
    refreshUserToken,
    getValidAccessToken
}; 