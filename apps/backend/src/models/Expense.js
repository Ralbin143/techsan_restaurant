import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = [
  "utilities",
  "rent",
  "payroll",
  "supplies",
  "marketing",
  "maintenance",
  "equipment",
  "insurance",
  "taxes",
  "other",
];

export const EXPENSE_STATUSES = ["pending", "approved", "paid", "rejected", "cancelled"];

export const EXPENSE_PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "upi",
  "cheque",
  "other",
];

const expenseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: "other",
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true, index: true },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
      default: "bank_transfer",
    },
    vendor: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      default: "pending",
      index: true,
    },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidAt: Date,
    approvedAt: Date,
  },
  { timestamps: true }
);

expenseSchema.index({ branchId: 1, expenseDate: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
