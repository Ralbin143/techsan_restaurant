export interface SocketOrder {
  _id: string;
  orderNumber: string;
  status: string;
  source?: string;
  total: number;
  subtotal?: number;
  createdAt: string;
  branchId?: string | { _id: string; restaurantId?: string };
  tableId?: { _id?: string; number?: string } | null;
  items: { _id?: string; name: string; quantity: number; unitPrice: number; status?: string }[];
  callWaiter?: boolean;
  requestBill?: boolean;
}

export type CustomerAlertType = "call_waiter" | "request_bill" | "cancel_order";

export interface CustomerAlert {
  id: string;
  type: CustomerAlertType;
  message: string;
  order: SocketOrder;
  at: string;
}

export function normalizeSocketOrder(raw: Record<string, unknown>): SocketOrder {
  const tableRaw = raw.tableId as { _id?: string; number?: string } | string | null | undefined;
  const items = (raw.items as Record<string, unknown>[]) || [];

  return {
    _id: String(raw._id),
    orderNumber: String(raw.orderNumber || ""),
    status: String(raw.status || "pending"),
    source: raw.source ? String(raw.source) : undefined,
    total: Number(raw.total || 0),
    subtotal: raw.subtotal != null ? Number(raw.subtotal) : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    branchId: raw.branchId as SocketOrder["branchId"],
    tableId:
      tableRaw && typeof tableRaw === "object"
        ? { _id: tableRaw._id ? String(tableRaw._id) : undefined, number: tableRaw.number }
        : null,
    callWaiter: Boolean(raw.callWaiter),
    requestBill: Boolean(raw.requestBill),
    items: items.map((line, i) => ({
      _id: line._id ? String(line._id) : `line-${i}`,
      name: String(line.name || "Item"),
      quantity: Number(line.quantity || 1),
      unitPrice: Number(line.unitPrice || 0),
      status: line.status ? String(line.status) : undefined,
    })),
  };
}

export function orderBranchId(order: SocketOrder): string | null {
  const b = order.branchId;
  if (!b) return null;
  return typeof b === "object" ? String(b._id) : String(b);
}

export function alertMessage(type: CustomerAlertType, order: SocketOrder): string {
  const table = order.tableId?.number ? `Table ${order.tableId.number}` : "A table";
  const num = order.orderNumber || "order";
  switch (type) {
    case "call_waiter":
      return `${table} — waiter requested (${num})`;
    case "request_bill":
      return `${table} — bill requested (${num})`;
    case "cancel_order":
      return `${table} — order cancelled (${num})`;
    default:
      return `${table} — update (${num})`;
  }
}

export function dispatchBranchChanged(branchId: string) {
  localStorage.setItem("branchId", branchId);
  window.dispatchEvent(new CustomEvent("branch-changed", { detail: { branchId } }));
}
