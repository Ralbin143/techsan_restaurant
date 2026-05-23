import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { softDeletePlugin } from "./plugins/softDelete.js";
import { ROLES } from "../constants/roles.js";

const deviceSchema = new mongoose.Schema(
  {
    deviceId: String,
    fcmToken: String,
    platform: { type: String, enum: ["web", "android", "ios"] },
    lastActiveAt: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true, sparse: true },
    phone: { type: String, trim: true, sparse: true },
    password: { type: String, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true,
    },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
    permissions: [String],
    avatar: String,
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    otp: { code: String, expiresAt: Date },
    refreshTokens: [
      {
        token: String,
        expiresAt: Date,
        deviceId: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    devices: [deviceSchema],
    lastLoginAt: Date,
    preferredLanguage: { type: String, default: "en" },
    loyaltyPoints: { type: Number, default: 0 },
    membershipPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan" },
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1, restaurantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: "string" },
    },
  }
);
userSchema.index(
  { phone: 1, restaurantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $exists: true, $type: "string" },
    },
  }
);
userSchema.plugin(softDeletePlugin);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);
