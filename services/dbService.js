const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// MongoDB URI
let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/auth2bot';
let config = null;
let client = null;
let db = null;

// Mongoose schemas
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

// Define models
let UserToken;
let Backup;

/**
 * Initialize the MongoDB connection
 */
async function initMongoDB() {
  if (!mongoUri) {
    console.error('MongoDB URI is not configured');
    return false;
  }

  try {
    // Connect with Mongoose for schema-based operations
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Define models
    UserToken = mongoose.model('UserToken', UserTokenSchema);
    Backup = mongoose.model('Backup', BackupSchema);
    
    // Also connect with MongoClient for more flexible operations
    client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db();
    
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

/**
 * Save a user token to the database
 * @param {Object} tokenData - User token data
 */
async function saveUserToken(tokenData) {
  try {
    // Check if we're connected to MongoDB
    if (!UserToken) {
      throw new Error('MongoDB is not connected');
    }
    
    const { id, username, access_token, refresh_token, expires_at, scopes } = tokenData;
    
    // Update if exists, create if not
    const result = await UserToken.updateOne(
      { userId: id },
      { 
        userId: id,
        username,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expires_at,
        scopes,
        updatedAt: new Date()
      },
      { upsert: true }
    );
    
    return { success: true, result };
  } catch (error) {
    console.error('Error saving user token to MongoDB:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a user token by user ID
 * @param {string} userId - Discord user ID
 */
async function getUserToken(userId) {
  try {
    if (!UserToken) {
      throw new Error('MongoDB is not connected');
    }
    
    const token = await UserToken.findOne({ userId });
    
    if (!token) {
      return null;
    }
    
    return {
      id: token.userId,
      username: token.username,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: token.expiresAt,
      scopes: token.scopes
    };
  } catch (error) {
    console.error('Error retrieving user token from MongoDB:', error);
    return null;
  }
}

/**
 * Save a backup to the database
 * @param {Object} backupData - Backup data
 */
async function saveBackup(backupData) {
  try {
    if (!Backup) {
      throw new Error('MongoDB is not connected');
    }
    
    const newBackup = new Backup({
      guildId: backupData.guildId,
      guildName: backupData.guildName,
      users: backupData.users,
      createdAt: new Date()
    });
    
    const result = await newBackup.save();
    return { success: true, backupId: result._id };
  } catch (error) {
    console.error('Error saving backup to MongoDB:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all backups
 */
async function getAllBackups() {
  try {
    if (!Backup) {
      throw new Error('MongoDB is not connected');
    }
    
    const backups = await Backup.find({}).sort({ createdAt: -1 });
    return backups;
  } catch (error) {
    console.error('Error retrieving backups from MongoDB:', error);
    return [];
  }
}

/**
 * Get a backup by guild ID
 * @param {string} guildId - Discord guild ID
 */
async function getBackupByGuildId(guildId) {
  try {
    if (!Backup) {
      throw new Error('MongoDB is not connected');
    }
    
    const backup = await Backup.findOne({ guildId }).sort({ createdAt: -1 });
    return backup;
  } catch (error) {
    console.error('Error retrieving backup from MongoDB:', error);
    return null;
  }
}

/**
 * Get all authorized users from the database
 */
async function getAllUsers() {
  try {
    if (!UserToken) {
      throw new Error('MongoDB is not connected');
    }
    
    const users = await UserToken.find({}, {
      userId: 1,
      username: 1,
      accessToken: 1,
      expiresAt: 1,
      scopes: 1,
      createdAt: 1,
      _id: 0
    }).sort({ username: 1 });
    
    return users.map(user => ({
      id: user.userId,
      username: user.username,
      expires_at: user.expiresAt,
      scopes: user.scopes,
      created_at: user.createdAt
    }));
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    return [];
  }
}

/**
 * Set the configuration
 * @param {Object} appConfig - Application configuration
 */
function setConfig(appConfig) {
  config = appConfig;
  
  // Override MongoDB URI if set in config
  if (config.mongodb && config.mongodb.uri) {
    mongoUri = config.mongodb.uri;
  }
  
  // Not automatically initializing MongoDB connection anymore
  // It will be explicitly initialized when needed
}

module.exports = {
  initMongoDB,
  setConfig,
  saveUserToken,
  getUserToken,
  saveBackup,
  getAllBackups,
  getBackupByGuildId,
  getAllUsers
}; 