import mongoose from "mongoose";

export const PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
  UPI: "upi",
  WALLET: "wallet",
  ONLINE: "online",
};

export const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  PARTIAL_REFUND: "partial_refund",
};

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    invoiceNumber: { type: String, unique: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tip: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundReason: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

paymentSchema.index({ branchId: 1, createdAt: -1 });
export const Payment = mongoose.model("Payment", paymentSchema);
