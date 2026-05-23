import { Router } from "express";
import * as purchaseController from "../../controllers/purchase.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSIONS } from "../../constants/roles.js";
import {
  createPurchaseOrderSchema,
  createSupplierSchema,
  updatePurchaseOrderSchema,
  updateSupplierSchema,
} from "../../validators/purchase.validator.js";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.INVENTORY_MANAGE));

router.get("/suppliers", purchaseController.listSuppliers);
router.post("/suppliers", validate(createSupplierSchema), purchaseController.createSupplier);
router.patch(
  "/suppliers/:id",
  validate(updateSupplierSchema),
  purchaseController.updateSupplier
);

router.get("/", purchaseController.listPurchaseOrders);
router.post("/", validate(createPurchaseOrderSchema), purchaseController.createPurchaseOrder);
router.get("/:id", purchaseController.getPurchaseOrder);
router.patch(
  "/:id",
  validate(updatePurchaseOrderSchema),
  purchaseController.updatePurchaseOrder
);
router.post("/:id/submit", purchaseController.submitPurchaseOrder);
router.post("/:id/receive", purchaseController.receivePurchaseOrder);
router.post("/:id/cancel", purchaseController.cancelPurchaseOrder);
router.delete("/:id", purchaseController.deletePurchaseOrder);

export default router;
