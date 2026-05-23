import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const ORDER_SOURCE = {
  QR: "qr",
  WAITER: "waiter",
  CASHIER: "cashier",
  ONLINE: "online",
};

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    variant: { name: String, price: Number },
    addons: [{ name: String, price: Number, quantity: Number }],
    notes: String,
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "cancelled"],
      default: "pending",
    },
    kitchenStation: String,
    startedAt: Date,
    readyAt: Date,
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", index: true },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    source: { type: String, enum: Object.values(ORDER_SOURCE), default: ORDER_SOURCE.WAITER },
    priority: { type: String, enum: ["normal", "high", "rush"], default: "normal" },
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestSessionId: String,
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    notes: String,
    cancelReason: String,
    callWaiter: { type: Boolean, default: false },
    requestBill: { type: Boolean, default: false },
    splitBills: [{ label: String, amount: Number, paid: Boolean }],
    parentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    acceptedAt: Date,
    completedAt: Date,
    cookingTimers: [{ itemId: mongoose.Schema.Types.ObjectId, startedAt: Date, duration: Number }],
  },
  { timestamps: true }
);

orderSchema.index({ branchId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tableId: 1, status: 1 });
orderSchema.plugin(softDeletePlugin);
export const Order = mongoose.model("Order", orderSchema);
