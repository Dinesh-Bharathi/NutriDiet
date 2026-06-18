import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import prisma from "./prisma.js";
import getRedisClient from "./redis.js";
import { PresenceStore } from "./presence.js";

let ioInstance = null;

export function initSocketServer(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: env.CLIENT_URL.split(","),
      credentials: true,
    },
    pingInterval: 60000,
    pingTimeout: 60000,
  });

  // Setup dynamic tenant namespaces: /tenant-{tenantId}
  const tenantNamespace = ioInstance.of(/^\/tenant-[\w-]+$/);

    tenantNamespace.use(async (socket, next) => {
      try {
        const cookies = socket.handshake.headers.cookie;
        let token = cookies
          ?.split("; ")
          ?.find((row) => row.startsWith("accessToken="))
          ?.split("=")[1];
  
        if (!token) {
          // Fallback 1: handshake auth
          token = socket.handshake.auth?.token;
        }

        if (!token) {
          // Fallback 2: Authorization header
          const authHeader = socket.handshake.headers.authorization;
          if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
          }
        }

        const redis = getRedisClient();

        if (!token) {
          logger.warn("[WHATSAPP_SOCKET] Unauthorized socket attempt: Access token missing.");
          if (redis) {
            await redis.incr("whatsapp:metrics:socket:failed");
          }
          return next(new Error("Authentication error: Access token missing."));
        }
  
        // Verify JWT
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
        
        // Extract tenantId from namespace
        const namespaceName = socket.nsp.name; // /tenant-cuid
        const namespaceTenantId = namespaceName.split("-")[1];
  
        if (decoded.tenantId !== namespaceTenantId) {
          logger.warn("[WHATSAPP_SOCKET] Unauthorized socket attempt: Tenant workspace mismatch.", {
            tokenTenantId: decoded.tenantId,
            namespaceTenantId,
          });
          if (redis) {
            await redis.incr("whatsapp:metrics:socket:failed");
          }
          return next(new Error("Authentication error: Tenant workspace mismatch."));
        }
  
        // Query database user to verify access
        const user = await prisma.user.findFirst({
          where: {
            id: decoded.id || decoded.sub, // Support sub standard too
            tenantId: decoded.tenantId,
          },
        });
  
        if (!user) {
          logger.warn("[WHATSAPP_SOCKET] Unauthorized socket attempt: User record missing.", {
            userId: decoded.id || decoded.sub,
            tenantId: decoded.tenantId,
          });
          if (redis) {
            await redis.incr("whatsapp:metrics:socket:failed");
          }
          return next(new Error("Authentication error: User record missing."));
        }
  
        socket.user = { id: user.id, role: user.role };
        socket.tenantId = decoded.tenantId;

        // Record metrics
        if (redis) {
          await redis.incr("whatsapp:metrics:socket:authenticated");
          const connTime = new Date().toISOString();
          await redis.set("whatsapp:socket:last_connection_at", connTime);
          await redis.set(`whatsapp:socket:last_connection_at:${socket.tenantId}`, connTime);
        }

        next();
      } catch (err) {
        logger.error("[WHATSAPP_SOCKET] Handshake authorization failed", { error: err.message });
        const redis = getRedisClient();
        if (redis) {
          await redis.incr("whatsapp:metrics:socket:failed");
        }
        next(new Error("Unauthorized connection."));
      }
    });
  
    tenantNamespace.on("connection", async (socket) => {
      socket.connectedAt = Date.now();
      
      // Join a user-specific room inside the tenant namespace for secure user-isolated notifications
      const userRoom = `user-${socket.user.id}`;
      socket.join(userRoom);

      // Register socket connection in PresenceStore
      await PresenceStore.registerConnection(socket.id, socket.user.id, socket.tenantId).catch((err) => {
        logger.error("[Presence] Failed to register connection on socket.io connect", { error: err.message });
      });

      // Broadcast user online status
      socket.nsp.emit("presence:update", {
        userId: socket.user.id,
        tenantId: socket.tenantId,
        activeConversationId: null,
        isOnline: true,
      });

      // Handle user presence tracking for smart notification suppression and online DTO updates
      socket.on("presence", async (data) => {
        const { conversationId, active } = data || {};
        if (active && conversationId) {
          socket.presenceConversationId = conversationId;
          socket.presenceLastSeenAt = Date.now();
          await PresenceStore.registerHeartbeat(socket.id, socket.user.id, conversationId).catch(() => {});
        } else {
          socket.presenceConversationId = null;
          socket.presenceLastSeenAt = null;
          await PresenceStore.registerHeartbeat(socket.id, socket.user.id, null).catch(() => {});
        }

        // Broadcast updated presence details
        socket.nsp.emit("presence:update", {
          userId: socket.user.id,
          tenantId: socket.tenantId,
          activeConversationId: socket.presenceConversationId,
          isOnline: true,
        });
      });

      // Handle typing events
      socket.on("typing:start", (data) => {
        const { conversationId } = data || {};
        if (conversationId) {
          socket.broadcast.emit("typing:start", {
            conversationId,
            userId: socket.user.id,
          });
        }
      });

      socket.on("typing:stop", (data) => {
        const { conversationId } = data || {};
        if (conversationId) {
          socket.broadcast.emit("typing:stop", {
            conversationId,
            userId: socket.user.id,
          });
        }
      });

      logger.info(`[WHATSAPP_SOCKET] Connected: socketId=${socket.id}, tenantId=${socket.tenantId}, userId=${socket.user.id}, room=${userRoom}`, {
        userId: socket.user.id,
        tenantId: socket.tenantId,
        socketId: socket.id,
        namespace: socket.nsp.name,
      });
  
      socket.on("disconnect", async (reason) => {
        const duration = Date.now() - (socket.connectedAt || Date.now());
        logger.info(`[WHATSAPP_SOCKET] Disconnected: socketId=${socket.id}, tenantId=${socket.tenantId}, reason=${reason}, duration=${duration}ms`, {
          userId: socket.user.id,
          tenantId: socket.tenantId,
          socketId: socket.id,
          reason,
          duration,
        });

        // Unregister presence
        await PresenceStore.registerDisconnect(socket.id, socket.user.id).catch(() => {});

        // Broadcast presence update (offline) if no other tabs are active
        const isOnline = await PresenceStore.isUserOnline(socket.user.id).catch(() => false);
        if (!isOnline) {
          socket.nsp.emit("presence:update", {
            userId: socket.user.id,
            tenantId: socket.tenantId,
            activeConversationId: null,
            isOnline: false,
          });
        }

        // Disconnect cleanup: clear typing state if typing
        if (socket.presenceConversationId) {
          socket.broadcast.emit("typing:stop", {
            conversationId: socket.presenceConversationId,
            userId: socket.user.id,
          });
        }
      });
    });
  
    return ioInstance;
  }
  
  /**
   * Safely emit a real-time event to a specific tenant workspace.
   *
   * @param {string} tenantId
   * @param {string} event
   * @param {any} data
   */
  export function emitTenantEvent(tenantId, event, data) {
    if (!ioInstance) {
      logger.warn(`[WHATSAPP_SOCKET] Server not initialized. Skipped broadcast: ${event}`);
      return;
    }
    
    logger.info("[WHATSAPP_SOCKET] Socket broadcast emitted", {
      eventName: event,
      tenantId,
      conversationId: data?.conversationId || data?.id || null,
      messageId: data?.id && event.includes("message") ? data.id : null,
    });
  
    ioInstance.of(`/tenant-${tenantId}`).emit(event, data);
  }

  /**
   * Safely emit a real-time event to a specific user within a tenant workspace.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} event
   * @param {any} data
   */
  export function emitUserEvent(tenantId, userId, event, data) {
    if (!ioInstance) {
      logger.warn(`[SOCKET] Server not initialized. Skipped user broadcast: ${event}`);
      return;
    }

    logger.info("[SOCKET] User socket broadcast emitted", {
      eventName: event,
      tenantId,
      userId,
    });

    ioInstance.of(`/tenant-${tenantId}`).to(`user-${userId}`).emit(event, data);
  }
 
  /**
   * Retrieve active connection counts for a specific tenant workspace.
   *
   * @param {string} tenantId
   * @returns {number}
   */
  export function getActiveConnectionsCount(tenantId) {
    if (!ioInstance) return 0;
    try {
      return ioInstance.of(`/tenant-${tenantId}`).sockets.size;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Checks if a user is actively viewing a specific conversation.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} conversationId
   * @returns {boolean} True if the user is active in the conversation
   */
  export function isUserActiveInConversation(tenantId, userId, conversationId) {
    if (!ioInstance) return false;
    
    const namespace = ioInstance.of(`/tenant-${tenantId}`);
    const activeSockets = Array.from(namespace.sockets.values());
    
    const ACTIVE_PRESENCE_WINDOW = 60 * 1000; // 60 seconds
    const now = Date.now();
    
    return activeSockets.some((s) => {
      return (
        s.user?.id === userId &&
        s.presenceConversationId === conversationId &&
        s.presenceLastSeenAt &&
        (now - s.presenceLastSeenAt < ACTIVE_PRESENCE_WINDOW)
      );
    });
  }
