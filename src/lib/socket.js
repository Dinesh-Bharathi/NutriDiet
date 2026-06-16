import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import prisma from "./prisma.js";

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
        const token = cookies
          ?.split("; ")
          ?.find((row) => row.startsWith("accessToken="))
          ?.split("=")[1];
  
        if (!token) {
          logger.warn("[WHATSAPP_SOCKET] Unauthorized socket attempt: Access token missing.");
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
          return next(new Error("Authentication error: Tenant workspace mismatch."));
        }
  
        // Query database user to verify access
        const user = await prisma.user.findFirst({
          where: {
            id: decoded.id,
            tenantId: decoded.tenantId,
          },
        });
  
        if (!user) {
          logger.warn("[WHATSAPP_SOCKET] Unauthorized socket attempt: User record missing.", {
            userId: decoded.id,
            tenantId: decoded.tenantId,
          });
          return next(new Error("Authentication error: User record missing."));
        }
  
        socket.user = { id: user.id, role: user.role };
        socket.tenantId = decoded.tenantId;
        next();
      } catch (err) {
        logger.error("[WHATSAPP_SOCKET] Handshake authorization failed", { error: err.message });
        next(new Error("Unauthorized connection."));
      }
    });
  
    tenantNamespace.on("connection", (socket) => {
      socket.connectedAt = Date.now();
      logger.info(`[WHATSAPP_SOCKET] Connected: socketId=${socket.id}, tenantId=${socket.tenantId}, userId=${socket.user.id}`, {
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
