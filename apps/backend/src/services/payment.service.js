import Razorpay from "razorpay";
import crypto from "crypto";
import {
  Payment,
  Order,
  Table,
  TABLE_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
} from "../models/index.js";
import { env } from "../config/env.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";

let razorpay;
if (env.razorpay.keyId && env.razorpay.keySecret) {
  razorpay = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
}

function generateInvoiceNumber() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

export class PaymentService {
  async processPayment({
    orderId,
    method,
    amount,
    tip,
    cashierId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
  }) {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.COMPLETED].includes(order.status)) {
      throw new ValidationError(`Cannot pay for an order that is ${order.status}`);
    }

    const existing = await Payment.findOne({
      orderId,
      status: PAYMENT_STATUS.COMPLETED,
    });
    if (existing) throw new ValidationError("This order has already been paid");

    if (method === PAYMENT_METHOD.ONLINE && razorpay) {
      const expected = crypto
        .createHmac("sha256", env.razorpay.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");
      if (expected !== razorpaySignature) {
        throw new ValidationError("Invalid payment signature");
      }
    }

    const payAmount = amount ?? order.total;
    const payment = await Payment.create({
      orderId,
      branchId: order.branchId,
      invoiceNumber: generateInvoiceNumber(),
      amount: payAmount,
      method,
      status: PAYMENT_STATUS.COMPLETED,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      cashierId,
      tip: tip ?? 0,
    });

    order.status = ORDER_STATUS.COMPLETED;
    order.completedAt = new Date();
    order.requestBill = false;
    order.callWaiter = false;
    await order.save();

    if (order.tableId) {
      await Table.findByIdAndUpdate(order.tableId, {
        status: TABLE_STATUS.CLEANING,
        currentOrderId: null,
      });
    }

    return {
      payment,
      order: await order.populate("tableId waiterId items.menuItemId"),
    };
  }

  async createRazorpayOrder(orderId) {
    if (!razorpay) throw new ValidationError("Razorpay not configured");
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.total * 100),
      currency: "INR",
      receipt: order.orderNumber,
    });

    return { razorpayOrderId: rzpOrder.id, amount: order.total, currency: "INR", keyId: env.razorpay.keyId };
  }

  async listPayments({ branchId, from, to, skip = 0, limit = 50 }) {
    const filter = { branchId, status: PAYMENT_STATUS.COMPLETED };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lt = to;
    }

    const [data, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          {
            path: "orderId",
            select: "orderNumber total status tableId",
            populate: { path: "tableId", select: "number" },
          },
          { path: "cashierId", select: "firstName lastName email" },
        ]),
      Payment.countDocuments(filter),
    ]);

    return { data, total };
  }

  async refund(paymentId, amount, reason) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

    payment.refundAmount = (payment.refundAmount || 0) + amount;
    payment.refundReason = reason;
    payment.status =
      payment.refundAmount >= payment.amount ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIAL_REFUND;
    await payment.save();
    return payment;
  }
}

export const paymentService = new PaymentService();
