import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import prisma from "./prisma.js";
import getRedisClient from "./redis.js";

let ioInstance = null;

export function initSocketServer(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: env.CLIENT_URL.split(","),
      credentials: true,
    },
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
  
    tenantNamespace.on("connection", (socket) => {
      socket.connectedAt = Date.now();
      
      // Join a user-specific room inside the tenant namespace for secure user-isolated notifications
      const userRoom = `user-${socket.user.id}`;
      socket.join(userRoom);

      logger.info(`[WHATSAPP_SOCKET] Connected: socketId=${socket.id}, tenantId=${socket.tenantId}, userId=${socket.user.id}, room=${userRoom}`, {
        userId: socket.user.id,
        tenantId: socket.tenantId,
        socketId: socket.id,
        namespace: socket.nsp.name,
      });
  
      socket.on("disconnect", (reason) => {
        const duration = Date.now() - (socket.connectedAt || Date.now());
        logger.info(`[WHATSAPP_SOCKET] Disconnected: socketId=${socket.id}, tenantId=${socket.tenantId}, reason=${reason}, duration=${duration}ms`, {
          userId: socket.user.id,
          tenantId: socket.tenantId,
          socketId: socket.id,
          reason,
          duration,
        });
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
