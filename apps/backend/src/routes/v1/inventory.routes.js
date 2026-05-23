import { Router } from "express";
import { Inventory, Supplier } from "../../models/index.js";
import { inventoryService } from "../../services/inventory.service.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSIONS } from "../../constants/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { NotFoundError } from "../../utils/apiError.js";
import { resolveBranchId } from "../../utils/branchResolver.js";
import { StatusCodes } from "http-status-codes";
import {
  adjustStockSchema,
  createInventorySchema,
  updateInventorySchema,
} from "../../validators/inventory.validator.js";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.INVENTORY_MANAGE));

router.get(
  "/suppliers",
  asyncHandler(async (req, res) => {
    const filter = req.user.restaurantId
      ? { restaurantId: req.user.restaurantId }
      : {};
    const data = await Supplier.find(filter).sort({ name: 1 });
    res.json({ success: true, data });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const branchId = await resolveBranchId(req.user, req.query.branchId);
    const data = await Inventory.find({ branchId })
      .sort({ name: 1 })
      .populate("supplierId", "name phone");
    res.json({ success: true, data });
  })
);

router.post(
  "/",
  validate(createInventorySchema),
  asyncHandler(async (req, res) => {
    const branchId = await resolveBranchId(req.user, req.body.branchId);
    const payload = { ...req.body, branchId };
    if (payload.sku === "") delete payload.sku;
    payload.valuation = (payload.currentStock ?? 0) * (payload.costPerUnit ?? 0);
    const item = await Inventory.create(payload);
    res.status(StatusCodes.CREATED).json({ success: true, data: item });
  })
);

router.patch(
  "/:id",
  validate(updateInventorySchema),
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    if (!item) throw new NotFoundError("Inventory item not found");

    Object.assign(item, req.body);
    if (req.body.sku === "") item.sku = undefined;
    item.valuation = item.currentStock * item.costPerUnit;
    await item.save();

    res.json({ success: true, data: item });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    if (!item) throw new NotFoundError("Inventory item not found");
    await item.softDelete();
    res.json({ success: true, message: "Inventory item deleted" });
  })
);

router.post(
  "/:id/stock",
  validate(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const branchId = await resolveBranchId(req.user, req.body.branchId);
    const result = await inventoryService.adjustStock(req.params.id, {
      ...req.body,
      performedBy: req.user._id,
      branchId,
    });
    res.json({ success: true, data: result });
  })
);

export default router;
