import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string(),
  password: Joi.string().required(),
  deviceId: Joi.string(),
  fcmToken: Joi.string(),
  platform: Joi.string().valid("web", "android", "ios"),
}).or("email", "phone");

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
  deviceId: Joi.string(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
  newPassword: Joi.string().min(8).required(),
});
