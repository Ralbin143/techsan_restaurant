import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const inventorySchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, index: true },
    barcode: String,
    unit: { type: String, required: true },
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    maxStock: Number,
    costPerUnit: { type: Number, default: 0 },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    menuItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }],
    consumptionPerServing: { type: Number, default: 0 },
    lastRestockedAt: Date,
    valuation: { type: Number, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.index({ branchId: 1, sku: 1 }, { unique: true, sparse: true });
inventorySchema.plugin(softDeletePlugin);
export const Inventory = mongoose.model("Inventory", inventorySchema);
