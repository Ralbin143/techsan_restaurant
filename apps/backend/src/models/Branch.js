import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const branchSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
      coordinates: { lat: Number, lng: Number },
    },
    phone: String,
    email: String,
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    operatingHours: [
      {
        day: { type: Number, min: 0, max: 6 },
        open: String,
        close: String,
        isClosed: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

branchSchema.index({ restaurantId: 1, code: 1 }, { unique: true });
branchSchema.plugin(softDeletePlugin);
export const Branch = mongoose.model("Branch", branchSchema);
