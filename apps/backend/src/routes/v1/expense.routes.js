import { Router } from "express";
import * as expenseController from "../../controllers/expense.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSIONS } from "../../constants/roles.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpenseSchema,
  summaryExpenseSchema,
} from "../../validators/expense.validator.js";

const router = Router();
const manage = [authenticate, requirePermission(PERMISSIONS.EXPENSE_MANAGE)];

router.get("/summary", ...manage, validate(summaryExpenseSchema, "query"), expenseController.getExpenseSummary);
router.get("/", ...manage, validate(listExpenseSchema, "query"), expenseController.listExpenses);
router.post("/", ...manage, validate(createExpenseSchema), expenseController.createExpense);
router.get("/:id", ...manage, expenseController.getExpense);
router.patch("/:id", ...manage, validate(updateExpenseSchema), expenseController.updateExpense);
router.post("/:id/approve", ...manage, expenseController.approveExpense);
router.post("/:id/mark-paid", ...manage, expenseController.markExpensePaid);
router.post("/:id/reject", ...manage, expenseController.rejectExpense);
router.post("/:id/cancel", ...manage, expenseController.cancelExpense);
router.delete("/:id", ...manage, expenseController.deleteExpense);

export default router;
