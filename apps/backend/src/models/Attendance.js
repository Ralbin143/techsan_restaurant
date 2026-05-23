import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    date: { type: Date, required: true, index: true },
    checkIn: Date,
    checkOut: Date,
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    status: {
      type: String,
      enum: ["present", "absent", "late", "half_day", "leave"],
      default: "present",
    },
    hoursWorked: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
export const Attendance = mongoose.model("Attendance", attendanceSchema);
