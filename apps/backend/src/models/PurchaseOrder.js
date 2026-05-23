import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    poNumber: { type: String, unique: true },
    items: [
      {
        inventoryId: mongoose.Schema.Types.ObjectId,
        quantity: Number,
        unitPrice: Number,
        total: Number,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "ordered", "received", "cancelled"],
      default: "draft",
    },
    totalAmount: { type: Number, default: 0 },
    expectedDelivery: Date,
    receivedAt: Date,
  },
  { timestamps: true }
);

export const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
