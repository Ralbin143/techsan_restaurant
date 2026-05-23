import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const taxSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ["gst", "service", "other"], default: "gst" },
    isInclusive: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

taxSchema.plugin(softDeletePlugin);
export const Tax = mongoose.model("Tax", taxSchema);
