import mongoose from "mongoose";

const stockTransactionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true, index: true },
    type: { type: String, enum: ["in", "out", "waste", "adjustment"], required: true },
    quantity: { type: Number, required: true },
    reason: String,
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    previousStock: Number,
    newStock: Number,
  },
  { timestamps: true }
);

stockTransactionSchema.index({ branchId: 1, createdAt: -1 });
export const StockTransaction = mongoose.model("StockTransaction", stockTransactionSchema);
