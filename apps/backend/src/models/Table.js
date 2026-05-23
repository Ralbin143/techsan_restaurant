import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

export const TABLE_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  CLEANING: "cleaning",
};

const tableSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    diningAreaId: { type: mongoose.Schema.Types.ObjectId, ref: "DiningArea", required: true },
    number: { type: String, required: true },
    capacity: { type: Number, default: 4 },
    status: {
      type: String,
      enum: Object.values(TABLE_STATUS),
      default: TABLE_STATUS.AVAILABLE,
      index: true,
    },
    qrCode: String,
    qrToken: { type: String, unique: true, sparse: true },
    mergedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Table" }],
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    assignedWaiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tableSchema.index({ branchId: 1, number: 1 }, { unique: true });
tableSchema.plugin(softDeletePlugin);
export const Table = mongoose.model("Table", tableSchema);
