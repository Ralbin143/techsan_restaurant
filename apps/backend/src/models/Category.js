import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const categorySchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    name: { type: String, required: true },
    description: String,
    image: String,
    sortOrder: { type: Number, default: 0 },
    kitchenStation: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ restaurantId: 1, name: 1, parentId: 1 });
categorySchema.plugin(softDeletePlugin);
export const Category = mongoose.model("Category", categorySchema);
