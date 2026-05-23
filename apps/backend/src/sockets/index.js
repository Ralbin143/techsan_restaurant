import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function initSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, env.jwt.accessSecret);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { branchId, restaurantId, role, tableId, isGuest } = socket.user;
    logger.debug(`Socket connected: ${socket.id} role=${role}`);

    if (branchId) socket.join(`branch:${branchId}`);
    if (restaurantId) socket.join(`restaurant:${restaurantId}`);
    if (role === "kitchen_staff") socket.join(`kitchen:${branchId}`);
    if (isGuest && tableId) socket.join(`table:${tableId}`);

    socket.on("join:table", (id) => {
      if (isGuest && tableId && String(id) !== String(tableId)) return;
      socket.join(`table:${id}`);
    });

    socket.on("join:branch", (id) => {
      if (isGuest || !id) return;
      for (const room of socket.rooms) {
        if (room.startsWith("branch:") && room !== `branch:${id}`) {
          socket.leave(room);
        }
      }
      socket.join(`branch:${id}`);
    });

    socket.on("kitchen:accept", (orderId) => {
      io.to(`branch:${branchId}`).emit("kitchen:accepted", { orderId, by: socket.user.sub });
    });

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
}

/**
 * Socket event catalog:
 * Client → Server: join:table, kitchen:accept
 * Server → Client:
 *   order:new, order:updated, order:ready, order:cancelled
 *   table:updated, table:call_waiter, table:request_bill
 *   customer:alert — { type, order, tableNumber, orderNumber, at }
 *   kitchen:accepted
 *   notification:push
 */
