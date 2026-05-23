import { StatusCodes } from "http-status-codes";
import { orderService } from "../services/order.service.js";
import { Order } from "../models/Order.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { ForbiddenError, NotFoundError } from "../utils/apiError.js";
import { resolveBranchId } from "../utils/branchResolver.js";
import { emitOrderEvent, emitCustomerAlert } from "../utils/socketEmit.js";

async function populateOrderForEmit(order) {
  return order.populate([
    { path: "tableId", select: "number" },
    { path: "branchId", select: "restaurantId name" },
    { path: "items.menuItemId" },
  ]);
}

function assertGuestOrderAccess(req, order) {
  if (!req.guest) return;
  const orderTableId = order.tableId?._id || order.tableId;
  if (String(orderTableId) !== String(req.guest.tableId)) {
    throw new ForbiddenError("You can only access orders for your table");
  }
}

export const createOrder = asyncHandler(async (req, res) => {
  const order = await populateOrderForEmit(await orderService.create(req.body, req.user));
  emitOrderEvent(req.app.get("io"), "order:new", order);
  res.status(StatusCodes.CREATED).json({ success: true, data: order });
});

export const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const filter = { branchId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.tableId) filter.tableId = req.query.tableId;
  if (req.query.requestBill === "true") filter.requestBill = true;
  if (req.query.callWaiter === "true") filter.callWaiter = true;
  if (req.query.hasServiceRequest === "true") {
    filter.$or = [{ callWaiter: true }, { requestBill: true }];
  }
  if (req.query.payableOnly === "true") {
    filter.status = { $nin: ["completed", "cancelled"] };
  }

  const [data, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("tableId waiterId"),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginatedResponse(data, total, { page, limit }) });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("tableId waiterId items.menuItemId");
  if (!order) throw new NotFoundError("Order not found");
  res.json({ success: true, data: order });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await populateOrderForEmit(
    await orderService.updateStatus(req.params.id, req.body.status, req.body.itemUpdates)
  );
  const io = req.app.get("io");
  emitOrderEvent(io, "order:updated", order);
  if (order.status === "ready") {
    emitOrderEvent(io, "order:ready", order);
  }
  res.json({ success: true, data: order });
});

export const getGuestTableOrders = asyncHandler(async (req, res) => {
  const tableId = req.guest?.tableId;
  if (!tableId) throw new ForbiddenError("Guest table session required");

  const orders = await Order.find({
    tableId,
    status: { $nin: ["completed", "cancelled"] },
  })
    .sort({ createdAt: -1 })
    .populate("items.menuItemId")
    .lean();

  res.json({ success: true, data: orders });
});

export const kitchenQueue = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const orders = await orderService.getKitchenQueue(branchId, { station: req.query.station });
  res.json({ success: true, data: orders });
});

export const callWaiter = asyncHandler(async (req, res) => {
  const existing = await Order.findById(req.params.id);
  if (!existing) throw new NotFoundError("Order not found");
  assertGuestOrderAccess(req, existing);

  const order = await populateOrderForEmit(await orderService.callWaiter(req.params.id));
  const io = req.app.get("io");
  emitOrderEvent(io, "table:call_waiter", order);
  if (req.guest) emitCustomerAlert(io, "call_waiter", order);
  res.json({ success: true, data: order });
});

export const requestBill = asyncHandler(async (req, res) => {
  const existing = await Order.findById(req.params.id);
  if (!existing) throw new NotFoundError("Order not found");
  assertGuestOrderAccess(req, existing);

  const order = await populateOrderForEmit(await orderService.requestBill(req.params.id));
  const io = req.app.get("io");
  emitOrderEvent(io, "table:request_bill", order);
  if (req.guest) emitCustomerAlert(io, "request_bill", order);
  res.json({ success: true, data: order });
});

export const updateServiceRequests = asyncHandler(async (req, res) => {
  const order = await orderService.updateServiceRequests(req.params.id, req.body);
  emitOrderEvent(req.app.get("io"), "order:updated", order);
  res.json({ success: true, data: order });
});

export const markBillDelivered = asyncHandler(async (req, res) => {
  const order = await orderService.markBillDelivered(req.params.id, req.body);
  emitOrderEvent(req.app.get("io"), "order:updated", order);
  res.json({ success: true, data: order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const existing = await Order.findById(req.params.id);
  if (!existing) throw new NotFoundError("Order not found");
  assertGuestOrderAccess(req, existing);

  const order = await populateOrderForEmit(
    await orderService.cancelOrder(req.params.id, req.body, {
      isGuest: Boolean(req.guest),
    })
  );
  const io = req.app.get("io");
  emitOrderEvent(io, "order:cancelled", order);
  emitOrderEvent(io, "order:updated", order);
  if (req.guest) emitCustomerAlert(io, "cancel_order", order);
  res.json({ success: true, data: order });
});
