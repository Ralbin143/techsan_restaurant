import { Expense } from "../models/Expense.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";

function buildListFilter({ branchId, status, category, from, to, search }) {
  const filter = { branchId };
  if (status && status !== "all") filter.status = status;
  if (category && category !== "all") filter.category = category;
  if (from || to) {
    filter.expenseDate = {};
    if (from) filter.expenseDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.expenseDate.$lte = end;
    }
  }
  if (search) {
    const q = search.trim();
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { vendor: { $regex: q, $options: "i" } },
      { referenceNumber: { $regex: q, $options: "i" } },
    ];
  }
  return filter;
}

export class ExpenseService {
  async list(params) {
    const filter = buildListFilter(params);
    return Expense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .populate("createdBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName");
  }

  async getById(id) {
    const expense = await Expense.findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName");
    if (!expense) throw new NotFoundError("Expense not found");
    return expense;
  }

  async create(body, userId) {
    return Expense.create({
      branchId: body.branchId,
      title: body.title.trim(),
      description: body.description?.trim(),
      category: body.category,
      amount: body.amount,
      expenseDate: body.expenseDate,
      paymentMethod: body.paymentMethod,
      vendor: body.vendor?.trim(),
      referenceNumber: body.referenceNumber?.trim(),
      notes: body.notes?.trim(),
      status: body.status === "paid" ? "paid" : "pending",
      createdBy: userId,
      paidAt: body.status === "paid" ? new Date() : undefined,
    });
  }

  async update(id, body) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (expense.status !== "pending") {
      throw new ValidationError("Only pending expenses can be edited");
    }

    const fields = [
      "title",
      "description",
      "category",
      "amount",
      "expenseDate",
      "paymentMethod",
      "vendor",
      "referenceNumber",
      "notes",
    ];
    for (const key of fields) {
      if (body[key] !== undefined) {
        expense[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
      }
    }
    await expense.save();
    return this.getById(id);
  }

  async approve(id, userId) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (expense.status !== "pending") {
      throw new ValidationError("Only pending expenses can be approved");
    }
    expense.status = "approved";
    expense.approvedBy = userId;
    expense.approvedAt = new Date();
    await expense.save();
    return this.getById(id);
  }

  async markPaid(id, userId) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (!["pending", "approved"].includes(expense.status)) {
      throw new ValidationError("This expense cannot be marked as paid");
    }
    expense.status = "paid";
    expense.paidAt = new Date();
    if (!expense.approvedBy) {
      expense.approvedBy = userId;
      expense.approvedAt = new Date();
    }
    await expense.save();
    return this.getById(id);
  }

  async reject(id) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (!["pending", "approved"].includes(expense.status)) {
      throw new ValidationError("This expense cannot be rejected");
    }
    expense.status = "rejected";
    await expense.save();
    return this.getById(id);
  }

  async cancel(id) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (expense.status === "paid") {
      throw new ValidationError("Paid expenses cannot be cancelled");
    }
    if (expense.status === "cancelled") {
      throw new ValidationError("Expense is already cancelled");
    }
    expense.status = "cancelled";
    await expense.save();
    return this.getById(id);
  }

  async delete(id) {
    const expense = await Expense.findById(id);
    if (!expense) throw new NotFoundError("Expense not found");
    if (!["pending", "cancelled", "rejected"].includes(expense.status)) {
      throw new ValidationError("Only pending, rejected, or cancelled expenses can be deleted");
    }
    await expense.deleteOne();
  }

  async summary({ branchId, from, to }) {
    const filter = buildListFilter({ branchId, from, to });

    const [byCategory, byStatus, totals] = await Promise.all([
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
            paidAmount: {
              $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] },
            },
            pendingAmount: {
              $sum: {
                $cond: [{ $in: ["$status", ["pending", "approved"]] }, "$amount", 0],
              },
            },
          },
        },
      ]),
    ]);

    const summary = totals[0] || {
      totalAmount: 0,
      count: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };

    return {
      from: from || null,
      to: to || null,
      ...summary,
      byCategory,
      byStatus,
    };
  }
}

export const expenseService = new ExpenseService();
