import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      restaurantId: user.restaurantId?.toString(),
      branchId: user.branchId?.toString(),
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function generateGuestToken({ guestSessionId, tableId, branchId }) {
  return jwt.sign(
    {
      sub: guestSessionId,
      role: "customer",
      tableId,
      branchId,
      isGuest: true,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.guestExpiresIn }
  );
}

export function verifyRefreshTokenHash(token, storedHash) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return hash === storedHash;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
