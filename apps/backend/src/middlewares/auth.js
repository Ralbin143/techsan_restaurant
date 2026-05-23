import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { UnauthorizedError, ForbiddenError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLE_PERMISSIONS } from "../constants/roles.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;

  if (!token) throw new UnauthorizedError("Access token required");

  const decoded = jwt.verify(token, env.jwt.accessSecret);
  const user = await User.findById(decoded.sub).select("-password -refreshTokens");

  if (!user || !user.isActive) throw new UnauthorizedError("User not found or inactive");

  req.user = user;
  req.tokenPayload = decoded;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, env.jwt.accessSecret);
      req.user = await User.findById(decoded.sub).select("-password -refreshTokens");
    }
  } catch {
    // guest flow
  }
  next();
});

export const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (roles.length && !roles.includes(req.user.role)) {
      throw new ForbiddenError("Insufficient role permissions");
    }
    next();
  });

export const requirePermission = (...permissions) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw new UnauthorizedError();
    const rolePerms = ROLE_PERMISSIONS[req.user.role] || [];
    const userPerms = [...rolePerms, ...(req.user.permissions || [])];
    const hasPermission = permissions.every((p) => userPerms.includes(p));
    if (!hasPermission) throw new ForbiddenError("Missing required permission");
    next();
  });
