import { StatusCodes } from "http-status-codes";
import { purchaseService } from "../services/purchase.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveBranchId } from "../utils/branchResolver.js";
import { ValidationError } from "../utils/apiError.js";
import { Branch } from "../models/Branch.js";

async function resolveRestaurantId(user, queryBranchId) {
  if (user?.restaurantId) return user.restaurantId.toString();
  if (queryBranchId) {
    const branch = await Branch.findById(queryBranchId);
    if (branch?.restaurantId) return branch.restaurantId.toString();
  }
  throw new ValidationError("Restaurant context is required for this action");
}

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await purchaseService.list({
    branchId,
    status: req.query.status,
  });
  res.json({ success: true, data });
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const data = await purchaseService.getById(req.params.id);
  res.json({ success: true, data });
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const data = await purchaseService.create({ ...req.body, branchId });
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const data = await purchaseService.update(req.params.id, req.body);
  res.json({ success: true, data });
});

export const submitPurchaseOrder = asyncHandler(async (req, res) => {
  const data = await purchaseService.submit(req.params.id);
  res.json({ success: true, data });
});

export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const data = await purchaseService.receive(req.params.id, req.user._id);
  res.json({ success: true, data });
});

export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const data = await purchaseService.cancel(req.params.id);
  res.json({ success: true, data });
});

export const deletePurchaseOrder = asyncHandler(async (req, res) => {
  await purchaseService.delete(req.params.id);
  res.json({ success: true, message: "Purchase order deleted" });
});

export const listSuppliers = asyncHandler(async (req, res) => {
  const restaurantId = await resolveRestaurantId(req.user, req.query.branchId);
  const data = await purchaseService.listSuppliers(restaurantId);
  res.json({ success: true, data });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const restaurantId = await resolveRestaurantId(
    req.user,
    req.body.branchId || req.query.branchId
  );
  const data = await purchaseService.createSupplier(restaurantId, req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const restaurantId = await resolveRestaurantId(req.user, req.query.branchId);
  const data = await purchaseService.updateSupplier(
    req.params.id,
    restaurantId,
    req.body
  );
  res.json({ success: true, data });
});
