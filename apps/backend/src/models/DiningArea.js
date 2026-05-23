import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const diningAreaSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true },
    description: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

diningAreaSchema.plugin(softDeletePlugin);
export const DiningArea = mongoose.model("DiningArea", diningAreaSchema);
