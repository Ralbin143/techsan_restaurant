import mongoose from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

const employeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    employeeCode: { type: String, required: true },
    designation: String,
    department: String,
    joinDate: Date,
    salary: {
      base: { type: Number, default: 0 },
      type: { type: String, enum: ["monthly", "hourly"], default: "monthly" },
    },
    bankDetails: {
      accountNumber: String,
      ifsc: String,
      bankName: String,
    },
    emergencyContact: { name: String, phone: String },
    documents: [{ type: String, url: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

employeeSchema.index({ branchId: 1, employeeCode: 1 }, { unique: true });
employeeSchema.plugin(softDeletePlugin);
export const Employee = mongoose.model("Employee", employeeSchema);
