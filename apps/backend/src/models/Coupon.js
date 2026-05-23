import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const couponSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscount: Number,
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    validFrom: Date,
    validUntil: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });
couponSchema.plugin(softDeletePlugin);
export const Coupon = mongoose.model("Coupon", couponSchema);
