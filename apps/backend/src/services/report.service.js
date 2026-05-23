import { Order, Payment, MenuItem, Order as OrderModel } from "../models/index.js";
import { PAYMENT_STATUS } from "../models/Payment.js";

export class ReportService {
  async dailySales(branchId, date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const payments = await Payment.aggregate([
      {
        $match: {
          branchId,
          status: PAYMENT_STATUS.COMPLETED,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$method",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          tips: { $sum: "$tip" },
        },
      },
    ]);

    const orders = await Order.countDocuments({
      branchId,
      createdAt: { $gte: start, $lte: end },
      status: "completed",
    });

    const grandTotal = payments.reduce((s, p) => s + p.total, 0);
    return { date: start, orders, grandTotal, byMethod: payments };
  }

  async topSellingItems(branchId, { from, to, limit = 10 }) {
    return OrderModel.aggregate([
      { $match: { branchId, createdAt: { $gte: from, $lte: to }, status: "completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItemId",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: limit },
    ]);
  }

  async peakHours(branchId, date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return Order.aggregate([
      { $match: { branchId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 }, revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } },
    ]);
  }

  async salesForecast(branchId, days = 7) {
    const history = await Order.aggregate([
      {
        $match: {
          branchId,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: "completed",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const avgRevenue =
      history.length > 0 ? history.reduce((s, d) => s + d.revenue, 0) / history.length : 0;

    const forecast = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      forecast.push({
        date: d.toISOString().split("T")[0],
        predictedRevenue: Math.round(avgRevenue * (0.9 + Math.random() * 0.2)),
        confidence: history.length >= 14 ? "medium" : "low",
      });
    }
    return { history, forecast, note: "Replace with ML model when sufficient data exists" };
  }
}

export const reportService = new ReportService();
