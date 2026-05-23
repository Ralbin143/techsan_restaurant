import { StatusCodes } from "http-status-codes";
import { authService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req.ip, req.get("user-agent"));
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken, req.body.deviceId);
  res.status(StatusCodes.OK).json({ success: true, data: tokens });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req.body.refreshToken);
  res.status(StatusCodes.OK).json({ success: true, message: "Logged out" });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(
    req.body.email,
    req.body.otp,
    req.body.newPassword
  );
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

export const guestSession = asyncHandler(async (req, res) => {
  const result = await authService.createGuestSession(req.body.tableId, req.body.branchId);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

export const me = asyncHandler(async (req, res) => {
  res.status(StatusCodes.OK).json({ success: true, data: authService.sanitizeUser(req.user) });
});
