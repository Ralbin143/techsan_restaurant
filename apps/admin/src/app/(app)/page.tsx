"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { RootState } from "@/store";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Clock,
  DollarSign,
  Grid3X3,
  Package,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  UtensilsCrossed,
  Receipt,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
}

interface DailySales {
  grandTotal?: number;
  orders?: number;
  byMethod?: { _id: string; total: number; count?: number }[];
}

interface TopItem {
  name?: string;
  quantity?: number;
  revenue?: number;
}

interface PeakHour {
  _id: number;
  count: number;
  revenue?: number;
}

interface TableRow {
  _id: string;
  number: string;
  status: string;
  currentOrderId?: string | null;
}

interface InventoryItem {
  currentStock: number;
  minStock: number;
}

interface RosterRow {
  employee: { _id: string };
  attendance: { status: string } | null;
}

interface PurchaseOrder {
  status: string;
}

interface DashboardData {
  dailySales: DailySales | null;
  topItems: TopItem[];
  peakHours: PeakHour[];
  tables: TableRow[];
  openOrders: number;
  serviceRequests: number;
  lowStock: number;
  outOfStock: number;
  pendingLeave: number;
  staffPresent: number;
  staffTotal: number;
  pendingPurchases: number;
  pendingExpenses: number;
  monthExpenses: number;
}

const emptyData: DashboardData = {
  dailySales: null,
  topItems: [],
  peakHours: [],
  tables: [],
  openOrders: 0,
  serviceRequests: 0,
  lowStock: 0,
  outOfStock: 0,
  pendingLeave: 0,
  staffPresent: 0,
  staffTotal: 0,
  pendingPurchases: 0,
  pendingExpenses: 0,
  monthExpenses: 0,
};

const QUICK_LINKS = [
  { href: "/orders", label: "Orders", icon: ShoppingCart, color: "bg-blue-500" },
  { href: "/cashier", label: "Cashier", icon: Banknote, color: "bg-green-500" },
  { href: "/tables", label: "Tables", icon: Grid3X3, color: "bg-purple-500" },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed, color: "bg-orange-500" },
  { href: "/inventory", label: "Inventory", icon: Package, color: "bg-amber-500" },
  { href: "/purchases", label: "Purchases", icon: Truck, color: "bg-cyan-500" },
  { href: "/expenses", label: "Expenses", icon: Receipt, color: "bg-rose-500" },
  { href: "/employees", label: "Employees", icon: Users, color: "bg-indigo-500" },
] as const;

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const PRESENT_STATUSES = new Set(["present", "late", "half_day"]);

function weekAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useSelector((s: RootState) => s.auth);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "cashier") {
      router.replace("/cashier");
    }
  }, [user?.role, router]);

  useEffect(() => {
    api
      .get("/branches")
      .then((res) => {
        const list: Branch[] = res.data.data || [];
        setBranches(list);
        const saved = localStorage.getItem("branchId");
        const id = saved && list.some((b) => b._id === saved) ? saved : list[0]?._id || "";
        if (id) setBranchId(id);
      })
      .catch(() => setError("Failed to load branches"));
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!branchId || user?.role === "cashier") return;
    setLoading(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [
        salesRes,
        topRes,
        peakRes,
        tablesRes,
        openOrdersRes,
        serviceRes,
        inventoryRes,
        leaveRes,
        rosterRes,
        purchasesRes,
        expenseSummaryRes,
      ] = await Promise.all([
        api.get("/reports/daily-sales", { params: { branchId } }),
        api.get("/reports/top-items", { params: { branchId, from: weekAgoIso(), limit: 5 } }),
        api.get("/reports/peak-hours", { params: { branchId } }),
        api.get("/tables/live", { params: { branchId } }),
        api.get("/orders", { params: { branchId, payableOnly: true, limit: 1 } }),
        api.get("/orders", { params: { branchId, hasServiceRequest: true, limit: 1 } }),
        api.get("/inventory", { params: { branchId } }),
        api.get("/employees/leave/list", { params: { branchId, status: "pending" } }),
        api.get("/employees/attendance/roster", { params: { branchId, date: today } }),
        api.get("/purchases", { params: { branchId } }),
        api.get("/expenses/summary", {
          params: { branchId, from: monthStartIso(), to: today },
        }),
      ]);

      const inventory: InventoryItem[] = inventoryRes.data.data || [];
      const roster: RosterRow[] = rosterRes.data.data || [];
      const purchases: PurchaseOrder[] = purchasesRes.data.data || [];

      setData({
        dailySales: salesRes.data.data,
        topItems: topRes.data.data || [],
        peakHours: peakRes.data.data || [],
        tables: tablesRes.data.data || [],
        openOrders: openOrdersRes.data.pagination?.total ?? 0,
        serviceRequests: serviceRes.data.pagination?.total ?? 0,
        lowStock: inventory.filter(
          (i) => i.currentStock > 0 && i.currentStock <= i.minStock
        ).length,
        outOfStock: inventory.filter((i) => i.currentStock <= 0).length,
        pendingLeave: (leaveRes.data.data || []).length,
        staffPresent: roster.filter((r) =>
          PRESENT_STATUSES.has(r.attendance?.status || "")
        ).length,
        staffTotal: roster.length,
        pendingPurchases: purchases.filter((p) =>
          ["draft", "ordered"].includes(p.status)
        ).length,
        pendingExpenses: expenseSummaryRes.data.data?.pendingAmount ?? 0,
        monthExpenses: expenseSummaryRes.data.data?.totalAmount ?? 0,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, user?.role]);

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("branchId", branchId);
      loadDashboard();
    }
  }, [branchId, loadDashboard]);

  const occupiedTables = useMemo(
    () =>
      data.tables.filter(
        (t) => t.status === "occupied" || t.currentOrderId
      ).length,
    [data.tables]
  );

  const peakMax = useMemo(
    () => Math.max(1, ...data.peakHours.map((h) => h.count)),
    [data.peakHours]
  );

  const alerts = useMemo(() => {
    const items: { text: string; href: string; tone: "amber" | "red" }[] = [];
    if (data.serviceRequests > 0) {
      items.push({
        text: `${data.serviceRequests} table${data.serviceRequests > 1 ? "s" : ""} need attention (waiter call or bill request)`,
        href: "/orders",
        tone: "red",
      });
    }
    if (data.outOfStock > 0) {
      items.push({
        text: `${data.outOfStock} inventory item${data.outOfStock > 1 ? "s" : ""} out of stock`,
        href: "/inventory",
        tone: "red",
      });
    }
    if (data.lowStock > 0) {
      items.push({
        text: `${data.lowStock} item${data.lowStock > 1 ? "s" : ""} below minimum stock`,
        href: "/inventory",
        tone: "amber",
      });
    }
    if (data.pendingPurchases > 0) {
      items.push({
        text: `${data.pendingPurchases} purchase order${data.pendingPurchases > 1 ? "s" : ""} awaiting action`,
        href: "/purchases",
        tone: "amber",
      });
    }
    if (data.pendingLeave > 0) {
      items.push({
        text: `${data.pendingLeave} leave request${data.pendingLeave > 1 ? "s" : ""} pending approval`,
        href: "/employees",
        tone: "amber",
      });
    }
    if (data.pendingExpenses > 0) {
      items.push({
        text: `${formatCurrency(data.pendingExpenses)} in expenses awaiting payment`,
        href: "/expenses",
        tone: "amber",
      });
    }
    return items;
  }, [data]);

  const primaryStats = [
    {
      label: "Today's revenue",
      value: formatCurrency(data.dailySales?.grandTotal || 0),
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      label: "Completed orders",
      value: String(data.dailySales?.orders || 0),
      icon: ShoppingBag,
      color: "bg-blue-500",
    },
    {
      label: "Occupied tables",
      value: `${occupiedTables} / ${data.tables.length}`,
      icon: Grid3X3,
      color: "bg-purple-500",
    },
    {
      label: "Staff present",
      value: data.staffTotal ? `${data.staffPresent} / ${data.staffTotal}` : "—",
      icon: Users,
      color: "bg-indigo-500",
    },
  ];

  const secondaryStats = [
    { label: "Open orders", value: data.openOrders, href: "/orders" },
    { label: "Low stock", value: data.lowStock + data.outOfStock, href: "/inventory" },
    { label: "Pending POs", value: data.pendingPurchases, href: "/purchases" },
    { label: "Pending leave", value: data.pendingLeave, href: "/employees" },
    {
      label: "Month expenses",
      value: formatCurrency(data.monthExpenses),
      href: "/expenses",
    },
  ];

  if (user?.role === "cashier") {
    return <p className="text-slate-500 text-center py-12">Redirecting to cashier…</p>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.firstName
              ? `Welcome back, ${user.firstName}. `
              : ""}
            Live overview for your branch.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={loadDashboard}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {primaryStats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold mt-1">{loading ? "…" : value}</p>
              </div>
              <div className={`${color} p-3 rounded-lg text-white`}>
                <Icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {secondaryStats.map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
          >
            <p className="text-xs text-slate-500 uppercase">{label}</p>
            <p className="text-xl font-bold mt-1 text-orange-600">
              {loading ? "…" : String(value)}
            </p>
          </Link>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-500" />
            Needs attention
          </h2>
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.text}>
                <Link
                  href={alert.href}
                  className={`text-sm flex items-center gap-2 hover:underline ${
                    alert.tone === "red" ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  <Bell size={14} />
                  {alert.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-semibold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-400 transition-colors"
            >
              <div className={`${color} p-2.5 rounded-lg text-white`}>
                <Icon size={20} />
              </div>
              <span className="text-xs font-medium text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold mb-4">Top selling items (7 days)</h2>
          <ul className="space-y-3">
            {data.topItems.map((item, i) => (
              <li key={i} className="flex justify-between text-sm gap-4">
                <span className="truncate">{item.name || "Item"}</span>
                <span className="text-slate-500 shrink-0">
                  {item.quantity} sold · {formatCurrency(item.revenue || 0)}
                </span>
              </li>
            ))}
            {!loading && !data.topItems.length && (
              <p className="text-slate-400 text-sm">No sales data yet</p>
            )}
            {loading && <p className="text-slate-400 text-sm">Loading…</p>}
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold mb-4">Payment breakdown (today)</h2>
          <ul className="space-y-2">
            {(data.dailySales?.byMethod || []).map((m) => (
              <li key={m._id} className="flex justify-between text-sm">
                <span className="capitalize">{m._id}</span>
                <span>
                  {formatCurrency(m.total)}
                  {m.count != null && (
                    <span className="text-slate-400 ml-1">({m.count})</span>
                  )}
                </span>
              </li>
            ))}
            {!loading && !data.dailySales?.byMethod?.length && (
              <p className="text-slate-400 text-sm">No payments recorded today</p>
            )}
            {loading && <p className="text-slate-400 text-sm">Loading…</p>}
          </ul>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-slate-400" />
          Peak hours (today)
        </h2>
        {data.peakHours.length === 0 && !loading ? (
          <p className="text-slate-400 text-sm">No order activity yet today</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }, (_, hour) => {
              const bucket = data.peakHours.find((h) => h._id === hour);
              const count = bucket?.count || 0;
              const height = count ? Math.max(8, (count / peakMax) * 100) : 4;
              return (
                <div
                  key={hour}
                  title={`${hour}:00 — ${count} orders`}
                  className="flex-1 bg-orange-500/80 dark:bg-orange-600 rounded-t min-w-0"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
          <span>12am</span>
          <span>6am</span>
          <span>12pm</span>
          <span>6pm</span>
          <span>11pm</span>
        </div>
      </div>
    </div>
  );
}
