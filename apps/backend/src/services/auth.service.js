import { User } from "../models/User.js";
import { ActivityLog } from "../models/ActivityLog.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateGuestToken,
  hashToken,
} from "./token.service.js";
import { UnauthorizedError, ValidationError, NotFoundError } from "../utils/apiError.js";
import { ROLES } from "../constants/roles.js";
import { emailService } from "./email.service.js";

const MAX_REFRESH_TOKENS = 5;

export class AuthService {
  async login({ email, phone, password, deviceId, fcmToken, platform }, ip, userAgent) {
    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError("Invalid credentials");
    }
    if (!user.isActive) throw new UnauthorizedError("Account is deactivated");

    const tokens = await this.issueTokens(user, { deviceId, fcmToken, platform });
    user.lastLoginAt = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      action: "auth.login",
      ip,
      userAgent,
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken, deviceId) {
    const hash = hashToken(refreshToken);
    const user = await User.findOne({
      "refreshTokens.token": hash,
      "refreshTokens.expiresAt": { $gt: new Date() },
    });

    if (!user) throw new UnauthorizedError("Invalid or expired refresh token");

    user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== hash);
    const tokens = await this.issueTokens(user, { deviceId });
    return tokens;
  }

  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (!user) return;

    if (refreshToken) {
      const hash = hashToken(refreshToken);
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== hash);
    } else {
      user.refreshTokens = [];
    }
    await user.save();
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { message: "If account exists, OTP sent to email" };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();
    await emailService.sendOtp(user.email, code);
    return { message: "If account exists, OTP sent to email" };
  }

  async resetPassword(email, otp, newPassword) {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user?.otp || user.otp.code !== otp || user.otp.expiresAt < new Date()) {
      throw new ValidationError("Invalid or expired OTP");
    }
    user.password = newPassword;
    user.otp = undefined;
    user.refreshTokens = [];
    await user.save();
    return { message: "Password reset successful" };
  }

  async createGuestSession(tableId, branchId) {
    const guestSessionId = `guest_${tableId}_${Date.now()}`;
    const accessToken = generateGuestToken({ guestSessionId, tableId, branchId });
    return { accessToken, guestSessionId, expiresIn: "2h" };
  }

  async issueTokens(user, { deviceId, fcmToken, platform } = {}) {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.refreshTokens.push({
      token: hashToken(refreshToken),
      expiresAt,
      deviceId,
    });

    if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
      user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS);
    }

    if (deviceId && fcmToken) {
      const existing = user.devices.find((d) => d.deviceId === deviceId);
      if (existing) {
        existing.fcmToken = fcmToken;
        existing.platform = platform;
        existing.lastActiveAt = new Date();
      } else {
        user.devices.push({ deviceId, fcmToken, platform, lastActiveAt: new Date() });
      }
    }

    await user.save();
    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    delete obj.refreshTokens;
    delete obj.otp;
    return obj;
  }
}

export const authService = new AuthService();
