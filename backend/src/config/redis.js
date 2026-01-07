/**
 * Redis Configuration
 * Used for storing active room IDs and session management
 */

const redis = require('redis');

let redisClient = null;

/**
 * Initialize Redis client
 */
async function initializeRedis() {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Redis] Max retries reached. Could not connect to Redis.');
            return new Error('Max retries reached');
          }
          return retries * 1000; // Exponential backoff
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    // Continue without Redis - fall back to in-memory validation
    return null;
  }
}

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if not connected
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    console.log('[Redis] Connection closed');
  }
}

module.exports = {
  initializeRedis,
  getRedisClient,
  closeRedis
};
