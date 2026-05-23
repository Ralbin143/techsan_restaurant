import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const supplierSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true },
    contactPerson: String,
    email: String,
    phone: String,
    address: String,
    paymentTerms: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.plugin(softDeletePlugin);
export const Supplier = mongoose.model("Supplier", supplierSchema);
