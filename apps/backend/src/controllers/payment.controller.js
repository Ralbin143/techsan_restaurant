import { StatusCodes } from "http-status-codes";
import { paymentService } from "../services/payment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emitOrderEvent } from "../utils/socketEmit.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { resolveBranchId } from "../utils/branchResolver.js";

function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const branchId = await resolveBranchId(req.user, req.query.branchId);

  let from;
  let to;
  if (req.query.from) from = new Date(req.query.from);
  if (req.query.to) to = new Date(req.query.to);
  if (!from && !to && req.query.date !== "all") {
    ({ from, to } = todayRange());
  }

  const { data, total } = await paymentService.listPayments({
    branchId,
    from,
    to,
    skip,
    limit,
  });

  res.json({ success: true, ...paginatedResponse(data, total, { page, limit }) });
});

export const processPayment = asyncHandler(async (req, res) => {
  const { payment, order } = await paymentService.processPayment({
    ...req.body,
    cashierId: req.user._id,
  });
  const io = req.app.get("io");
  emitOrderEvent(io, "order:updated", order);
  emitOrderEvent(io, "payment:completed", { payment, order });
  res.status(StatusCodes.CREATED).json({
    success: true,
    data: { payment, order },
  });
});

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const data = await paymentService.createRazorpayOrder(req.body.orderId);
  res.json({ success: true, data });
});

export const refundPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.refund(
    req.params.id,
    req.body.amount,
    req.body.reason
  );
  res.json({ success: true, data: payment });
});
