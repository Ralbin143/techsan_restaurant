import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
    type: {
      type: String,
      enum: [
        "order_new",
        "order_ready",
        "low_stock",
        "payroll",
        "reservation",
        "call_waiter",
        "request_bill",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: String,
    data: mongoose.Schema.Types.Mixed,
    isRead: { type: Boolean, default: false, index: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
export const Notification = mongoose.model("Notification", notificationSchema);
