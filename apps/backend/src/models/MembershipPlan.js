import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const membershipPlanSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    benefits: {
      discountPercent: { type: Number, default: 0 },
      loyaltyMultiplier: { type: Number, default: 1 },
      freeItems: [String],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

membershipPlanSchema.plugin(softDeletePlugin);
export const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);
