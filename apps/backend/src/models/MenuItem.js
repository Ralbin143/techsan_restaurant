import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    sku: String,
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const addonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    maxQuantity: { type: Number, default: 1 },
  },
  { _id: true }
);

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true },
    description: String,
    /** Ingredients, allergens, or other guest-facing detail (plain text / multiline). */
    ingredients: String,
    image: String,
    basePrice: { type: Number, required: true },
    variants: [variantSchema],
    addons: [addonSchema],
    isVeg: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true, index: true },
    preparationTime: { type: Number, default: 15 },
    kitchenStation: String,
    taxRate: { type: Number, default: 0 },
    tags: [String],
    comboItems: [{ menuItemId: mongoose.Schema.Types.ObjectId, quantity: Number }],
    happyHourPricing: [
      {
        startTime: String,
        endTime: String,
        days: [Number],
        price: Number,
        discountPercent: Number,
      },
    ],
    barcode: String,
    sortOrder: { type: Number, default: 0 },
    rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurantId: 1, name: "text", description: "text" });
menuItemSchema.plugin(softDeletePlugin);
export const MenuItem = mongoose.model("MenuItem", menuItemSchema);
