import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    logo: String,
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    taxInclusive: { type: Boolean, default: false },
    settings: {
      enableQrOrdering: { type: Boolean, default: true },
      enableLoyalty: { type: Boolean, default: true },
      enableReservations: { type: Boolean, default: true },
      defaultLanguage: { type: String, default: "en" },
      supportedLanguages: { type: [String], default: ["en", "hi"] },
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

restaurantSchema.plugin(softDeletePlugin);
export const Restaurant = mongoose.model("Restaurant", restaurantSchema);
