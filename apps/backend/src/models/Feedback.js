import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    menuItemRatings: [
      { menuItemId: mongoose.Schema.Types.ObjectId, rating: Number, comment: String },
    ],
  },
  { timestamps: true }
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);
