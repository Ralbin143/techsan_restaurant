import { Router } from "express";
import * as paymentController from "../../controllers/payment.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { processPaymentSchema } from "../../validators/payment.validator.js";
import { PERMISSIONS } from "../../constants/roles.js";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  requirePermission(PERMISSIONS.PAYMENT_PROCESS),
  paymentController.listPayments
);

router.post(
  "/",
  requirePermission(PERMISSIONS.PAYMENT_PROCESS),
  validate(processPaymentSchema),
  paymentController.processPayment
);
router.post("/razorpay/order", requirePermission(PERMISSIONS.PAYMENT_PROCESS), paymentController.createRazorpayOrder);
router.post("/:id/refund", requirePermission(PERMISSIONS.PAYMENT_PROCESS), paymentController.refundPayment);

export default router;
