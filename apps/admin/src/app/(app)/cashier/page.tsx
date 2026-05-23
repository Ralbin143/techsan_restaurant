"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { dispatchBranchChanged } from "@/lib/orderSocket";
import { useCustomerAlerts } from "@/contexts/CustomerAlertsContext";
import {
  CounterPayModal,
  type CounterPayMethod,
} from "@/components/cashier/CounterPayModal";
import {
  Banknote,
  CreditCard,
  Receipt,
  RefreshCw,
  Search,
  Smartphone,
  Wallet,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

interface PayableOrder {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  tableId?: { number?: string } | null;
  items: OrderItem[];
  requestBill?: boolean;
  callWaiter?: boolean;
}

interface PaymentRecord {
  _id: string;
  invoiceNumber: string;
  amount: number;
  tip: number;
  method: string;
  createdAt: string;
  orderId?: {
    orderNumber?: string;
    tableId?: { number?: string } | null;
  } | null;
  cashierId?: { firstName?: string; lastName?: string } | null;
}

const PAYABLE_STATUSES = ["pending", "confirmed", "preparing", "ready", "served"];

const METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
  wallet: Wallet,
};

export default function CashierPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<PayableOrder[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tab, setTab] = useState<"collect" | "history">("collect");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<PayableOrder | null>(null);
  const [processing, setProcessing] = useState(false);
  const { connected, registerOrderListener } = useCustomerAlerts();

  const mergeOrder = useCallback((incoming: PayableOrder) => {
    setOrders((prev) => {
      if (["completed", "cancelled"].includes(incoming.status)) {
        return prev.filter((o) => o._id !== incoming._id);
      }
      const idx = prev.findIndex((o) => o._id === incoming._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      }
      if (PAYABLE_STATUSES.includes(incoming.status)) {
        return [incoming, ...prev];
      }
      return prev;
    });
  }, []);

  const loadPayableOrders = useCallback(async () => {
    if (!branchId) return;
    const res = await api.get("/orders", {
      params: { branchId, payableOnly: "true", limit: "100" },
    });
    setOrders(res.data.data || []);
  }, [branchId]);

  const loadPayments = useCallback(async () => {
    if (!branchId) return;
    const res = await api.get("/payments", {
      params: { branchId, limit: "100" },
    });
    setPayments(res.data.data || []);
  }, [branchId]);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPayableOrders(), loadPayments()]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load cashier data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, loadPayableOrders, loadPayments]);

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
      refresh();
    }
  }, [branchId, refresh]);

  useEffect(() => {
    return registerOrderListener((incoming) => {
      mergeOrder(incoming as PayableOrder);
      if (incoming.status === "completed") {
        loadPayments();
      }
    });
  }, [registerOrderListener, mergeOrder, loadPayments]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.tableId?.number?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.invoiceNumber?.toLowerCase().includes(q) ||
        p.orderId?.orderNumber?.toLowerCase().includes(q) ||
        p.orderId?.tableId?.number?.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const todayStats = useMemo(() => {
    const total = payments.reduce((s, p) => s + p.amount + (p.tip || 0), 0);
    const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount + (p.tip || 0);
      return acc;
    }, {});
    return { count: payments.length, total, byMethod };
  }, [payments]);

  const processPayment = async (method: CounterPayMethod, tip: number) => {
    if (!payModal) return;
    setProcessing(true);
    try {
      const res = await api.post("/payments", {
        orderId: payModal._id,
        method,
        amount: payModal.total,
        tip,
      });
      const order = res.data.data?.order;
      if (order?._id) mergeOrder(order);
      setPayModal(null);
      await loadPayments();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Payment failed";
      alert(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="text-orange-600" size={28} />
            Cashier
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Collect counter payments and view today&apos;s transactions
            {connected && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-700"
          >
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Awaiting payment</p>
          <p className="text-2xl font-bold mt-1">{orders.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Paid today</p>
          <p className="text-2xl font-bold mt-1">{todayStats.count}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 col-span-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Today&apos;s total</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(todayStats.total)}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
            {Object.entries(todayStats.byMethod).map(([method, amt]) => (
              <span key={method} className="capitalize">
                {method}: {formatCurrency(amt)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # or table..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
        <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setTab("collect")}
            className={`px-4 py-2.5 text-sm font-medium ${
              tab === "collect"
                ? "bg-orange-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600"
            }`}
          >
            Collect ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-4 py-2.5 text-sm font-medium ${
              tab === "history"
                ? "bg-orange-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600"
            }`}
          >
            Paid today ({payments.length})
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 text-center py-12">Loading...</p>
      ) : tab === "collect" ? (
        filteredOrders.length === 0 ? (
          <p className="text-slate-400 text-center py-12">No open orders awaiting payment</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">
                      Table {order.tableId?.number || "—"} · {order.status}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(order.total)}</p>
                </div>

                {(order.requestBill || order.callWaiter) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {order.requestBill && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                        <Receipt size={12} />
                        Bill requested
                      </span>
                    )}
                    {order.callWaiter && (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                        Waiter called
                      </span>
                    )}
                  </div>
                )}

                <ul className="text-sm space-y-1 mb-4 text-slate-600 dark:text-slate-400">
                  {order.items?.slice(0, 4).map((item, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                    </li>
                  ))}
                  {(order.items?.length || 0) > 4 && (
                    <li className="text-slate-400">+{order.items.length - 4} more items</li>
                  )}
                </ul>

                <button
                  type="button"
                  onClick={() => setPayModal(order)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <Banknote size={18} />
                  Collect payment
                </button>
              </div>
            ))}
          </div>
        )
      ) : filteredPayments.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No payments recorded today</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3 font-medium">Invoice</th>
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Table</th>
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const MethodIcon = METHOD_ICONS[p.method] || Banknote;
                  const collected = p.amount + (p.tip || 0);
                  return (
                    <tr key={p._id} className="border-b dark:border-slate-800 last:border-0">
                      <td className="p-3 font-mono text-xs">{p.invoiceNumber}</td>
                      <td className="p-3">{p.orderId?.orderNumber || "—"}</td>
                      <td className="p-3">{p.orderId?.tableId?.number || "—"}</td>
                      <td className="p-3 capitalize flex items-center gap-1">
                        <MethodIcon size={14} />
                        {p.method}
                        {p.tip > 0 && (
                          <span className="text-slate-400 text-xs">+{formatCurrency(p.tip)} tip</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(collected)}</td>
                      <td className="p-3 text-slate-500">
                        {new Date(p.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payModal && (
        <CounterPayModal
          order={payModal}
          processing={processing}
          onClose={() => !processing && setPayModal(null)}
          onConfirm={processPayment}
        />
      )}
    </div>
  );
}
