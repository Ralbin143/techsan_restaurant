import Joi from "joi";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_STATUSES,
} from "../models/Expense.js";

export const createExpenseSchema = Joi.object({
  branchId: Joi.string(),
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).allow(""),
  category: Joi.string()
    .valid(...EXPENSE_CATEGORIES)
    .default("other"),
  amount: Joi.number().greater(0).required(),
  expenseDate: Joi.date().required(),
  paymentMethod: Joi.string()
    .valid(...EXPENSE_PAYMENT_METHODS)
    .default("bank_transfer"),
  vendor: Joi.string().trim().max(200).allow(""),
  referenceNumber: Joi.string().trim().max(100).allow(""),
  notes: Joi.string().trim().max(500).allow(""),
  status: Joi.string().valid("pending", "paid"),
});

export const updateExpenseSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  description: Joi.string().trim().max(1000).allow(""),
  category: Joi.string().valid(...EXPENSE_CATEGORIES),
  amount: Joi.number().greater(0),
  expenseDate: Joi.date(),
  paymentMethod: Joi.string().valid(...EXPENSE_PAYMENT_METHODS),
  vendor: Joi.string().trim().max(200).allow(""),
  referenceNumber: Joi.string().trim().max(100).allow(""),
  notes: Joi.string().trim().max(500).allow(""),
});

export const listExpenseSchema = Joi.object({
  branchId: Joi.string(),
  status: Joi.string().valid("all", ...EXPENSE_STATUSES),
  category: Joi.string().valid("all", ...EXPENSE_CATEGORIES),
  from: Joi.date(),
  to: Joi.date(),
  search: Joi.string().trim().max(100),
});

export const summaryExpenseSchema = Joi.object({
  branchId: Joi.string(),
  from: Joi.date(),
  to: Joi.date(),
});
