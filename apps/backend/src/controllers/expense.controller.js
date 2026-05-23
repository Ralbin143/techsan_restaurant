import { StatusCodes } from "http-status-codes";
import { expenseService } from "../services/expense.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveBranchId } from "../utils/branchResolver.js";

export const listExpenses = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await expenseService.list({
    branchId,
    status: req.query.status,
    category: req.query.category,
    from: req.query.from,
    to: req.query.to,
    search: req.query.search,
  });
  res.json({ success: true, data });
});

export const getExpenseSummary = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await expenseService.summary({
    branchId,
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
});

export const getExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.getById(req.params.id);
  res.json({ success: true, data });
});

export const createExpense = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const data = await expenseService.create({ ...req.body, branchId }, req.user._id);
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.update(req.params.id, req.body);
  res.json({ success: true, data });
});

export const approveExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.approve(req.params.id, req.user._id);
  res.json({ success: true, data });
});

export const markExpensePaid = asyncHandler(async (req, res) => {
  const data = await expenseService.markPaid(req.params.id, req.user._id);
  res.json({ success: true, data });
});

export const rejectExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.reject(req.params.id);
  res.json({ success: true, data });
});

export const cancelExpense = asyncHandler(async (req, res) => {
  const data = await expenseService.cancel(req.params.id);
  res.json({ success: true, data });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await expenseService.delete(req.params.id);
  res.json({ success: true, message: "Expense deleted" });
});
