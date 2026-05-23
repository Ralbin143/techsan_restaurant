import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLES } from "../constants/roles.js";

/** Allows staff JWT or guest session JWT for QR ordering */
export const authenticateStaffOrGuest = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new UnauthorizedError("Access token required");

  const decoded = jwt.verify(token, env.jwt.accessSecret);

  if (decoded.isGuest) {
    req.guest = {
      guestSessionId: decoded.sub,
      tableId: decoded.tableId,
      branchId: decoded.branchId,
      role: ROLES.CUSTOMER,
    };
    req.user = {
      _id: decoded.sub,
      role: ROLES.CUSTOMER,
      branchId: decoded.branchId,
    };
    return next();
  }

  const { User } = await import("../models/User.js");
  const user = await User.findById(decoded.sub).select("-password -refreshTokens");
  if (!user || !user.isActive) throw new UnauthorizedError("User not found or inactive");
  req.user = user;
  next();
});
