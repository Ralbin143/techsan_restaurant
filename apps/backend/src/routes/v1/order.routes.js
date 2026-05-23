import { Router } from "express";
import * as orderController from "../../controllers/order.controller.js";
import { authenticate, authorize, requirePermission } from "../../middlewares/auth.js";
import { authenticateStaffOrGuest } from "../../middlewares/guestAuth.js";
import { validate } from "../../middlewares/validate.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updateServiceRequestsSchema,
  markBillDeliveredSchema,
  cancelOrderSchema,
} from "../../validators/order.validator.js";
import { ROLES } from "../../constants/roles.js";
import { PERMISSIONS } from "../../constants/roles.js";

const router = Router();

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.ORDER_CREATE),
  validate(createOrderSchema),
  orderController.createOrder
);

router.post(
  "/guest",
  authenticateStaffOrGuest,
  validate(createOrderSchema),
  orderController.createOrder
);

router.get("/guest/table", authenticateStaffOrGuest, orderController.getGuestTableOrders);

router.post("/:id/call-waiter", authenticateStaffOrGuest, orderController.callWaiter);
router.post("/:id/request-bill", authenticateStaffOrGuest, orderController.requestBill);
router.post(
  "/:id/cancel",
  authenticateStaffOrGuest,
  validate(cancelOrderSchema),
  orderController.cancelOrder
);

router.use(authenticate);

router.get("/", requirePermission(PERMISSIONS.ORDER_VIEW), orderController.getOrders);
router.get("/kitchen", authorize(ROLES.KITCHEN, ROLES.MANAGER), orderController.kitchenQueue);
router.get("/:id", requirePermission(PERMISSIONS.ORDER_VIEW), orderController.getOrder);

router.patch(
  "/:id/status",
  authorize(
    ROLES.SUPER_ADMIN,
    ROLES.RESTAURANT_ADMIN,
    ROLES.MANAGER,
    ROLES.WAITER,
    ROLES.KITCHEN,
    ROLES.CASHIER
  ),
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

router.patch(
  "/:id/service-requests",
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate(updateServiceRequestsSchema),
  orderController.updateServiceRequests
);

router.post(
  "/:id/mark-bill-delivered",
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate(markBillDeliveredSchema),
  orderController.markBillDelivered
);

export default router;
