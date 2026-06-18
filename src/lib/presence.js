import getRedisClient, { isRedisAvailable } from "./redis.js";
import logger from "../utils/logger.js";

// Memory Fallback Store
const memoryUserSockets = new Map();      // userId -> Set<socketId>
const memorySocketPresence = new Map();   // socketId -> { userId, tenantId, activeConversationId, connectedAt, lastSeenAt }
const memoryUserLastSeen = new Map();     // userId -> timestamp

const HEARTBEAT_TIMEOUT = 45 * 1000;      // 45 seconds

/**
 * Cleanup expired memory sockets (runs periodically)
 */
export function cleanupExpiredMemorySockets() {
  const now = Date.now();
  for (const [socketId, sData] of memorySocketPresence.entries()) {
    if (now - sData.lastSeenAt > HEARTBEAT_TIMEOUT) {
      logger.info(`[Presence] Socket ${socketId} expired (no heartbeat)`);
      memorySocketPresence.delete(socketId);
      
      const uSockets = memoryUserSockets.get(sData.userId);
      if (uSockets) {
        uSockets.delete(socketId);
        if (uSockets.size === 0) {
          memoryUserSockets.delete(sData.userId);
        }
      }
    }
  }
}

// Run memory cleanup every 15 seconds
if (process.env.NODE_ENV !== "test") {
  setInterval(cleanupExpiredMemorySockets, 15000);
}

export const PresenceStore = {
  /**
   * Registers a socket connection
   */
  async registerConnection(socketId, userId, tenantId) {
    const now = Date.now();
    
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const socketKey = `whatsapp:socket:presence:${socketId}`;
        const userSocketsKey = `whatsapp:user:sockets:${userId}`;
        const lastSeenKey = `whatsapp:user:last_seen:${userId}`;
        
        await redis.sadd(userSocketsKey, socketId);
        await redis.expire(userSocketsKey, 86400); // 1 day expiry
        
        const data = {
          userId,
          tenantId,
          activeConversationId: "",
          connectedAt: now,
          lastSeenAt: now,
        };
        await redis.set(socketKey, JSON.stringify(data), "EX", 45);
        await redis.set(lastSeenKey, String(now));
        return;
      } catch (err) {
        logger.error("[Presence] Redis registerConnection error", { error: err.message });
      }
    }
    
    // Memory fallback
    if (!memoryUserSockets.has(userId)) {
      memoryUserSockets.set(userId, new Set());
    }
    memoryUserSockets.get(userId).add(socketId);
    
    memorySocketPresence.set(socketId, {
      userId,
      tenantId,
      activeConversationId: null,
      connectedAt: now,
      lastSeenAt: now,
    });
    memoryUserLastSeen.set(userId, now);
  },

  /**
   * Registers a heartbeat (typing state or visible tab tracking)
   */
  async registerHeartbeat(socketId, userId, conversationId = null) {
    const now = Date.now();
    
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const socketKey = `whatsapp:socket:presence:${socketId}`;
        const userSocketsKey = `whatsapp:user:sockets:${userId}`;
        const lastSeenKey = `whatsapp:user:last_seen:${userId}`;
        
        const raw = await redis.get(socketKey);
        let sData = raw ? JSON.parse(raw) : null;
        if (!sData) {
          // Re-create if expired
          sData = {
            userId,
            tenantId: "", // will be resolved or set empty
            activeConversationId: conversationId || "",
            connectedAt: now,
            lastSeenAt: now,
          };
        } else {
          sData.activeConversationId = conversationId || "";
          sData.lastSeenAt = now;
        }
        
        await redis.sadd(userSocketsKey, socketId);
        await redis.set(socketKey, JSON.stringify(sData), "EX", 45);
        await redis.set(lastSeenKey, String(now));
        return;
      } catch (err) {
        logger.error("[Presence] Redis registerHeartbeat error", { error: err.message });
      }
    }
    
    // Memory fallback
    const sData = memorySocketPresence.get(socketId);
    if (sData) {
      sData.activeConversationId = conversationId || null;
      sData.lastSeenAt = now;
      memoryUserLastSeen.set(userId, now);
      
      // Ensure socket is in set
      if (!memoryUserSockets.has(userId)) {
        memoryUserSockets.set(userId, new Set());
      }
      memoryUserSockets.get(userId).add(socketId);
    }
  },

  /**
   * Registers a socket disconnection
   */
  async registerDisconnect(socketId, userId) {
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const socketKey = `whatsapp:socket:presence:${socketId}`;
        const userSocketsKey = `whatsapp:user:sockets:${userId}`;
        
        await redis.srem(userSocketsKey, socketId);
        await redis.del(socketKey);
        return;
      } catch (err) {
        logger.error("[Presence] Redis registerDisconnect error", { error: err.message });
      }
    }
    
    // Memory fallback
    memorySocketPresence.delete(socketId);
    const uSockets = memoryUserSockets.get(userId);
    if (uSockets) {
      uSockets.delete(socketId);
      if (uSockets.size === 0) {
        memoryUserSockets.delete(userId);
      }
    }
  },

  /**
   * Returns whether a user is online
   */
  async isUserOnline(userId) {
    const presence = await this.getUserPresence(userId);
    return presence ? presence.isOnline : false;
  },

  /**
   * Returns the last seen timestamp of a user
   */
  async getUserLastSeen(userId) {
    const presence = await this.getUserPresence(userId);
    return presence ? presence.lastSeenAt : null;
  },

  /**
   * Returns full presence data for a user
   */
  async getUserPresence(userId) {
    const now = Date.now();
    
    if (isRedisAvailable()) {
      try {
        const redis = getRedisClient();
        const userSocketsKey = `whatsapp:user:sockets:${userId}`;
        const lastSeenKey = `whatsapp:user:last_seen:${userId}`;
        
        const socketIds = await redis.smembers(userSocketsKey);
        const lastSeenTimestamp = await redis.get(lastSeenKey);
        const lastSeenAt = lastSeenTimestamp ? parseInt(lastSeenTimestamp, 10) : null;
        
        if (!socketIds || socketIds.length === 0) {
          return {
            userId,
            tenantId: "",
            activeConversationId: null,
            connectedAt: null,
            lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null,
            isOnline: false,
          };
        }
        
        // Fetch all socket details
        const socketKeys = socketIds.map((sid) => `whatsapp:socket:presence:${sid}`);
        const rawSockets = await redis.mget(socketKeys);
        
        const activeSockets = [];
        const expiredSocketIds = [];
        
        rawSockets.forEach((raw, idx) => {
          if (!raw) {
            expiredSocketIds.push(socketIds[idx]);
            return;
          }
          const sData = JSON.parse(raw);
          if (now - sData.lastSeenAt < HEARTBEAT_TIMEOUT) {
            activeSockets.push(sData);
          } else {
            expiredSocketIds.push(socketIds[idx]);
          }
        });
        
        // Cleanup expired sockets in the background
        if (expiredSocketIds.length > 0) {
          redis.srem(userSocketsKey, ...expiredSocketIds).catch(() => {});
        }
        
        if (activeSockets.length === 0) {
          return {
            userId,
            tenantId: "",
            activeConversationId: null,
            connectedAt: null,
            lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null,
            isOnline: false,
          };
        }
        
        // Find most recently active socket
        activeSockets.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
        const latestSocket = activeSockets[0];
        
        // Min connectedAt
        const minConnectedAt = Math.min(...activeSockets.map((s) => s.connectedAt));
        
        return {
          userId,
          tenantId: latestSocket.tenantId,
          activeConversationId: latestSocket.activeConversationId || null,
          connectedAt: new Date(minConnectedAt),
          lastSeenAt: new Date(latestSocket.lastSeenAt),
          isOnline: true,
        };
      } catch (err) {
        logger.error("[Presence] Redis getUserPresence error", { error: err.message });
      }
    }
    
    // Memory fallback
    const socketIds = memoryUserSockets.get(userId);
    const lastSeenVal = memoryUserLastSeen.get(userId) || null;
    
    if (!socketIds || socketIds.size === 0) {
      return {
        userId,
        tenantId: "",
        activeConversationId: null,
        connectedAt: null,
        lastSeenAt: lastSeenVal ? new Date(lastSeenVal) : null,
        isOnline: false,
      };
    }
    
    const activeSockets = [];
    for (const sid of socketIds) {
      const sData = memorySocketPresence.get(sid);
      if (sData) {
        if (now - sData.lastSeenAt < HEARTBEAT_TIMEOUT) {
          activeSockets.push(sData);
        }
      }
    }
    
    if (activeSockets.length === 0) {
      return {
        userId,
        tenantId: "",
        activeConversationId: null,
        connectedAt: null,
        lastSeenAt: lastSeenVal ? new Date(lastSeenVal) : null,
        isOnline: false,
      };
    }
    
    // Sort by latest lastSeenAt
    activeSockets.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    const latestSocket = activeSockets[0];
    const minConnectedAt = Math.min(...activeSockets.map((s) => s.connectedAt));
    
    return {
      userId,
      tenantId: latestSocket.tenantId,
      activeConversationId: latestSocket.activeConversationId || null,
      connectedAt: new Date(minConnectedAt),
      lastSeenAt: new Date(latestSocket.lastSeenAt),
      isOnline: true,
    };
  },
};
