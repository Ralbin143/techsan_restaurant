import mongoose from "mongoose";

export const RESERVATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SEATED: "seated",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
};

const reservationSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: String,
    partySize: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    time: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUS),
      default: RESERVATION_STATUS.PENDING,
      index: true,
    },
    notes: String,
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reservationSchema.index({ branchId: 1, date: 1, status: 1 });
export const Reservation = mongoose.model("Reservation", reservationSchema);
