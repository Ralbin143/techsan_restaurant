function toPlainOrder(order) {
  return typeof order?.toJSON === "function" ? order.toJSON() : order;
}

/** Emit order events to branch staff, restaurant admins, and guest table. */
export function emitOrderEvent(io, event, order) {
  if (!io || !order) return;

  const payload = toPlainOrder(order);
  const branchId = payload.branchId?._id || payload.branchId;
  const restaurantId =
    payload.branchId?.restaurantId || payload.restaurantId;
  const tableId = payload.tableId?._id || payload.tableId;

  if (branchId) io.to(`branch:${branchId}`).emit(event, payload);
  if (restaurantId) io.to(`restaurant:${restaurantId}`).emit(event, payload);
  if (tableId) io.to(`table:${tableId}`).emit(event, payload);
}

/** Staff-facing alert for guest-initiated actions (cancel, waiter, bill). */
export function emitCustomerAlert(io, type, order) {
  if (!io || !order) return;
  const payload = toPlainOrder(order);
  const alert = {
    type,
    order: payload,
    at: new Date().toISOString(),
    tableNumber: payload.tableId?.number || null,
    orderNumber: payload.orderNumber,
  };

  const branchId = payload.branchId?._id || payload.branchId;

  // Branch room only — staff subscribe via join:branch (prevents duplicate toasts
  // when a client is in both branch and restaurant rooms).
  if (branchId) io.to(`branch:${branchId}`).emit("customer:alert", alert);
}
