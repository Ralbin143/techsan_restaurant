"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MenuItemThumb } from "@/components/menu/MenuItemThumb";
import { formatCurrency } from "@/lib/utils";
import { dispatchBranchChanged } from "@/lib/orderSocket";
import { useCustomerAlerts } from "@/contexts/CustomerAlertsContext";
import { CounterPayModal, type CounterPayMethod } from "@/components/cashier/CounterPayModal";
import { Banknote, Bell, Plus, Receipt, RefreshCw, X, XCircle } from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Table {
  _id: string;
  number: string;
  status: string;
}

interface MenuItem {
  _id: string;
  name: string;
  basePrice: number;
  image?: string | null;
  isAvailable: boolean;
}

interface OrderItem {
  _id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  status?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  source: string;
  total: number;
  subtotal: number;
  createdAt: string;
  tableId?: { number: string } | null;
  items: OrderItem[];
  callWaiter?: boolean;
  requestBill?: boolean;
}

const STATUSES = [
  "all",
  "requests",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  served: "bg-purple-100 text-purple-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

const nextStatus: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "served",
  served: "completed",
};

const CANCELLABLE_STATUSES = ["pending", "confirmed", "preparing", "ready", "served"];

const PAYABLE_STATUSES = ["pending", "confirmed", "preparing", "ready", "served"];

export default function OrdersPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [cart, setCart] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<Order | null>(null);
  const [payProcessing, setPayProcessing] = useState(false);
  const { requestCount, registerOrderListener, refreshRequestCount, connected } =
    useCustomerAlerts();

  const mergeOrder = useCallback((incoming: Order) => {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o._id === incoming._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      return [incoming, ...prev];
    });
  }, []);

  const loadOrders = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { branchId, limit: "50" };
      if (statusFilter === "requests") {
        params.hasServiceRequest = "true";
      } else if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const res = await api.get("/orders", { params });
      setOrders(res.data.data || []);
      await refreshRequestCount(branchId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, statusFilter, refreshRequestCount]);

  const loadFormData = useCallback(async () => {
    if (!branchId) return;
    const [tablesRes, menuRes] = await Promise.all([
      api.get("/tables/live", { params: { branchId } }),
      api.get("/menu/items"),
    ]);
    setTables(tablesRes.data.data);
    setMenuItems(menuRes.data.data.filter((m: MenuItem) => m.isAvailable));
  }, [branchId]);

  useEffect(() => {
    api
      .get("/branches")
      .then((res) => {
        const list: Branch[] = res.data.data;
        setBranches(list);
        const saved = localStorage.getItem("branchId");
        const id =
          saved && list.some((b) => b._id === saved) ? saved : list[0]?._id || "";
        if (id) setBranchId(id);
      })
      .catch(() => setError("Failed to load branches"));
  }, []);

  useEffect(() => {
    if (branchId) {
      dispatchBranchChanged(branchId);
      loadOrders();
    }
  }, [branchId, loadOrders]);

  useEffect(() => {
    return registerOrderListener((incoming) => {
      const order = incoming as Order;
      if (
        statusFilter === "requests" &&
        !order.callWaiter &&
        !order.requestBill
      ) {
        setOrders((prev) => prev.filter((o) => o._id !== order._id));
        return;
      }
      mergeOrder(order);
    });
  }, [registerOrderListener, mergeOrder, statusFilter]);

  const openNewOrder = async () => {
    await loadFormData();
    setCart([]);
    setSelectedTable("");
    setModalOpen(true);
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item._id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item._id, quantity: 1 }];
    });
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || cart.length === 0) {
      alert("Select a table and add at least one item");
      return;
    }
    setSaving(true);
    try {
      await api.post("/orders", {
        branchId,
        tableId: selectedTable,
        source: "waiter",
        items: cart,
      });
      setModalOpen(false);
      await loadOrders();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create order";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status });
      mergeOrder(res.data.data);
    } catch {
      alert("Failed to update status");
    }
  };

  const clearServiceRequest = async (
    orderId: string,
    fields: { callWaiter?: boolean; requestBill?: boolean }
  ) => {
    setActionId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/service-requests`, fields);
      mergeOrder(res.data.data);
      await refreshRequestCount(branchId);
    } catch {
      alert("Failed to update request");
    } finally {
      setActionId(null);
    }
  };

  const cancelOrder = async (orderId: string, orderNumber: string) => {
    const reason = window.prompt(
      `Cancel order ${orderNumber}?\n\nOptional reason:`
    );
    if (reason === null) return;

    setActionId(`cancel-${orderId}`);
    try {
      const res = await api.post(`/orders/${orderId}/cancel`, { reason: reason || "" });
      mergeOrder(res.data.data);
      await refreshRequestCount(branchId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to cancel order";
      alert(message);
    } finally {
      setActionId(null);
    }
  };

  const processCounterPay = async (method: CounterPayMethod, tip: number) => {
    if (!payModal) return;

    setPayProcessing(true);
    try {
      const res = await api.post("/payments", {
        orderId: payModal._id,
        method,
        amount: payModal.total,
        tip,
      });
      const order = res.data.data?.order || res.data.data;
      if (order?._id) mergeOrder(order);
      setPayModal(null);
      await refreshRequestCount(branchId);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Payment failed";
      alert(message);
    } finally {
      setPayProcessing(false);
    }
  };

  const markBillDelivered = async (orderId: string) => {
    setActionId(`bill-${orderId}`);
    try {
      const res = await api.post(`/orders/${orderId}/mark-bill-delivered`, {
        completeOrder: true,
      });
      mergeOrder(res.data.data);
      await refreshRequestCount(branchId);
    } catch {
      alert("Failed to mark bill as delivered");
    } finally {
      setActionId(null);
    }
  };

  const cartTotal = cart.reduce((sum, line) => {
    const item = menuItems.find((m) => m._id === line.menuItemId);
    return sum + (item?.basePrice || 0) * line.quantity;
  }, 0);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {connected ? "Live customer alerts enabled" : "Connecting to live updates…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                dispatchBranchChanged(e.target.value);
              }}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700"
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadOrders}
            className="p-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={openNewOrder}
            disabled={!branchId}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} />
            New Order
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs capitalize ${
              statusFilter === s
                ? "bg-orange-600 text-white"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {s === "requests" ? "Bill & waiter" : s}
            {s === "requests" && requestCount > 0 && (
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full ${
                  statusFilter === "requests"
                    ? "bg-white text-orange-600"
                    : "bg-red-500 text-white"
                }`}
              >
                {requestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={loadOrders} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 mb-4">No orders found</p>
          <button
            onClick={openNewOrder}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm"
          >
            Create first order
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const hasRequest = order.callWaiter || order.requestBill;
            return (
            <div
              key={order._id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-5 ${
                hasRequest
                  ? "border-red-300 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-900"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                <div>
                  <p className="font-bold text-lg">{order.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    Table {order.tableId?.number || "—"} · {order.source} ·{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {order.callWaiter && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center gap-1">
                      <Bell size={12} />
                      Waiter called
                    </span>
                  )}
                  {order.requestBill && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <Receipt size={12} />
                      Bill requested
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 rounded-full text-xs capitalize ${
                      statusColors[order.status] || ""
                    }`}
                  >
                    {order.status}
                  </span>
                  <span className="font-bold">{formatCurrency(order.total)}</span>
                </div>
              </div>

              {hasRequest && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                    Guest service request
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {order.requestBill && (
                      <>
                        <button
                          type="button"
                          disabled={actionId === `bill-${order._id}`}
                          onClick={() => markBillDelivered(order._id)}
                          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <Receipt size={14} />
                          {actionId === `bill-${order._id}`
                            ? "Processing..."
                            : "Bill delivered"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === order._id}
                          onClick={() =>
                            clearServiceRequest(order._id, { requestBill: false })
                          }
                          className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <X size={14} />
                          Dismiss bill request
                        </button>
                      </>
                    )}
                    {order.callWaiter && (
                      <button
                        type="button"
                        disabled={actionId === order._id}
                        onClick={() =>
                          clearServiceRequest(order._id, { callWaiter: false })
                        }
                        className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center gap-1 disabled:opacity-50"
                      >
                        <Bell size={14} />
                        {actionId === order._id ? "Processing..." : "Waiter attended"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <ul className="text-sm space-y-1 mb-3">
                {order.items?.map((item, i) => (
                  <li key={i} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {PAYABLE_STATUSES.includes(order.status) && (
                  <button
                    type="button"
                    disabled={payProcessing && payModal?._id === order._id}
                    onClick={() => setPayModal(order)}
                    className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50 hover:bg-green-700"
                  >
                    <Banknote size={14} />
                    Counter pay
                  </button>
                )}
                {nextStatus[order.status] && (
                  <button
                    onClick={() => updateStatus(order._id, nextStatus[order.status])}
                    className="text-sm px-3 py-1.5 bg-orange-600 text-white rounded-lg"
                  >
                    Mark as {nextStatus[order.status]}
                  </button>
                )}
                {CANCELLABLE_STATUSES.includes(order.status) && (
                  <button
                    type="button"
                    disabled={actionId === `cancel-${order._id}`}
                    onClick={() => cancelOrder(order._id, order.orderNumber)}
                    className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-lg flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    {actionId === `cancel-${order._id}` ? "Cancelling..." : "Cancel order"}
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {payModal && (
        <CounterPayModal
          order={payModal}
          processing={payProcessing}
          onClose={() => !payProcessing && setPayModal(null)}
          onConfirm={processCounterPay}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">New Order</h2>
            <form onSubmit={createOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Table</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                >
                  <option value="">Select table</option>
                  {tables.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.number} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Menu items</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {menuItems.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => addToCart(item)}
                      className="text-left p-2 border rounded-lg hover:border-orange-500 text-sm dark:border-slate-700 flex gap-2 items-start"
                    >
                      <MenuItemThumb src={item.image} name={item.name} />
                      <span className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-orange-600">₹{item.basePrice}</p>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {cart.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Cart</p>
                  <ul className="text-sm space-y-1">
                    {cart.map((line) => {
                      const item = menuItems.find((m) => m._id === line.menuItemId);
                      return (
                        <li key={line.menuItemId} className="flex justify-between">
                          <span>
                            {line.quantity}x {item?.name}
                          </span>
                          <span>₹{(item?.basePrice || 0) * line.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="font-bold mt-2">Total: {formatCurrency(cartTotal)}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || cart.length === 0}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Placing..." : "Place Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
