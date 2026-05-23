"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import {
  Bell,
  ChevronRight,
  Minus,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { createSocket } from "@/lib/socket";
import { formatCurrency } from "@/lib/utils";
import { WaitWhileCooking } from "@/components/order/WaitWhileCooking";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface MenuItem {
  _id: string;
  name: string;
  basePrice: number;
  description?: string;
  image?: string | null;
  isVeg: boolean;
}

interface MenuGroup {
  _id: string;
  name: string;
  items: MenuItem[];
  subcategories?: { _id: string; name: string; items: MenuItem[] }[];
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface OrderLine {
  _id: string;
  name: string;
  quantity: number;
  status: string;
}

interface ActiveOrder {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  items: OrderLine[];
  callWaiter?: boolean;
  requestBill?: boolean;
  createdAt: string;
}

interface TableData {
  _id: string;
  number: string;
  branchId:
    | string
    | {
        _id: string;
        restaurantId?: string;
      };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Order received",
  confirmed: "Confirmed by kitchen",
  preparing: "Being prepared",
  ready: "Ready — on the way!",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-900 ring-amber-500/25",
  confirmed: "bg-sky-500/15 text-sky-900 ring-sky-500/25",
  preparing: "bg-orange-500/15 text-orange-900 ring-orange-500/25",
  ready: "bg-emerald-500/15 text-emerald-900 ring-emerald-500/25",
  served: "bg-stone-500/15 text-stone-800 ring-stone-400/30",
  cancelled: "bg-red-500/15 text-red-900 ring-red-500/25",
};

const GUEST_CANCELLABLE = ["pending", "confirmed"];

function resolveRestaurantId(branch: TableData["branchId"]): string | null {
  if (!branch) return null;
  if (typeof branch === "object") {
    return branch.restaurantId ? String(branch.restaurantId) : null;
  }
  return null;
}

function resolveBranchId(branch: TableData["branchId"]): string {
  return typeof branch === "string" ? branch : branch._id;
}

function guestStorageKey(tableId: string) {
  return `guestToken_${tableId}`;
}

function upsertOrder(orders: ActiveOrder[], incoming: ActiveOrder): ActiveOrder[] {
  if (["completed", "cancelled"].includes(incoming.status)) {
    return orders.filter((o) => o._id !== incoming._id);
  }
  const idx = orders.findIndex((o) => o._id === incoming._id);
  if (idx >= 0) {
    const next = [...orders];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  return [incoming, ...orders];
}

function extractCancelReason(raw: Record<string, unknown>): string | undefined {
  const explicit = raw.cancelReason;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }
  const notes = String(raw.notes || "");
  const match = notes.match(/\[Cancelled\]\s*(.+)/);
  return match?.[1]?.trim() || undefined;
}

function cancelMessageForGuest(reason?: string): string {
  if (!reason) return "This order was cancelled by the restaurant.";
  if (reason === "Cancelled by guest") return "You cancelled this order.";
  return reason;
}

function normalizeOrder(raw: Record<string, unknown>): ActiveOrder {
  const items = (raw.items as Record<string, unknown>[]) || [];
  return {
    _id: String(raw._id),
    orderNumber: String(raw.orderNumber || ""),
    status: String(raw.status || "pending"),
    total: Number(raw.total || 0),
    callWaiter: Boolean(raw.callWaiter),
    requestBill: Boolean(raw.requestBill),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    items: items.map((line) => ({
      _id: String(line._id),
      name: String(line.name || (line.menuItemId as { name?: string })?.name || "Item"),
      quantity: Number(line.quantity || 1),
      status: String(line.status || "pending"),
    })),
  };
}

/** Resolve menu image URL for API-relative paths or absolute URLs */
function resolveMenuImageUrl(src?: string | null): string | undefined {
  if (!src || typeof src !== "string") return undefined;
  const t = src.trim();
  if (!t) return undefined;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const base = API_URL.replace(/\/$/, "");
  return t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
}

function MenuDishPhoto({
  src,
  alt,
  fallbackLetter,
}: {
  src?: string | null;
  alt: string;
  fallbackLetter: string;
}) {
  const [broken, setBroken] = useState(false);
  const url = resolveMenuImageUrl(src);
  if (!url || broken) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-stone-200 via-amber-100/80 to-orange-200/90">
        <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 text-stone-500">
          <UtensilsCrossed className="h-8 w-8 opacity-60" strokeWidth={1.25} />
          <span className="text-lg font-semibold text-stone-600/90">{fallbackLetter}</span>
        </div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
    />
  );
}

export default function QROrderPage() {
  const { token } = useParams<{ token: string }>();
  const [table, setTable] = useState<TableData | null>(null);
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "cancel" } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<ActiveOrder | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const showToast = useCallback(
    (msg: string, variant: "success" | "cancel" = "success") => {
      setToast({ message: msg, variant });
      setTimeout(() => setToast(null), 6000);
    },
    []
  );

  const ensureGuestSession = useCallback(async (tableData: TableData) => {
    const stored = sessionStorage.getItem(guestStorageKey(tableData._id));
    if (stored) {
      setGuestToken(stored);
      return stored;
    }

    const branchId = resolveBranchId(tableData.branchId);
    const session = await axios.post(`${API_URL}/api/v1/auth/guest-session`, {
      tableId: tableData._id,
      branchId,
    });
    const accessToken = session.data.data.accessToken as string;
    sessionStorage.setItem(guestStorageKey(tableData._id), accessToken);
    setGuestToken(accessToken);
    return accessToken;
  }, []);

  const fetchTableOrders = useCallback(async (authToken: string) => {
    const res = await axios.get(`${API_URL}/api/v1/orders/guest/table`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const orders = (res.data.data || []).map((o: Record<string, unknown>) =>
      normalizeOrder(o)
    );
    setActiveOrders(orders);
  }, []);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    axios
      .get(`${API_URL}/api/v1/tables/qr/${token}`)
      .then(async (res) => {
        const tableData: TableData = res.data.data;
        setTable(tableData);

        const restaurantId = resolveRestaurantId(tableData.branchId);
        if (!restaurantId) {
          throw new Error("Could not resolve restaurant for this table.");
        }

        const authToken = await ensureGuestSession(tableData);
        await fetchTableOrders(authToken);

        return axios.get(`${API_URL}/api/v1/menu/public/${restaurantId}`);
      })
      .then((res) => {
        if (!res) return;

        let nextGroups: MenuGroup[] = [];
        if (res.data?.data?.grouped?.length) {
          nextGroups = res.data.data.grouped.filter(
            (g: MenuGroup) =>
              g.items?.length > 0 || g.subcategories?.some((s) => s.items?.length > 0)
          );
        } else {
          const items: (MenuItem & { categoryId?: string | { _id: string } })[] =
            res.data.data.items || [];
          const categories = res.data.data.categories || [];
          nextGroups = categories
            .map((c: { _id: string; name: string }) => ({
              _id: c._id,
              name: c.name,
              items: items.filter((i) => {
                const catId = i.categoryId;
                const id = typeof catId === "object" && catId ? catId._id : catId;
                return id && String(id) === c._id;
              }),
            }))
            .filter((g: MenuGroup) => g.items.length > 0);
        }
        setGroups(nextGroups);
        if (nextGroups[0]) setActiveCategoryId(nextGroups[0]._id);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to load table or menu. Check that the backend is running.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token, ensureGuestSession, fetchTableOrders]);

  useEffect(() => {
    if (!guestToken || !table) return;

    const socket = createSocket(guestToken);
    socketRef.current = socket;

    const onOrderEvent = (payload: Record<string, unknown>) => {
      const order = normalizeOrder(payload);
      setActiveOrders((prev) => upsertOrder(prev, order));

      if (payload.status === "ready") {
        showToast(`Order ${order.orderNumber} is ready!`);
      } else if (payload.status === "preparing") {
        showToast(`Kitchen started preparing order ${order.orderNumber}`);
      } else if (payload.status === "served") {
        showToast(`Order ${order.orderNumber} has been served`);
      } else if (payload.status === "cancelled") {
        const reason = extractCancelReason(payload);
        const detail = cancelMessageForGuest(reason);
        showToast(`Order ${order.orderNumber} was cancelled — ${detail}`, "cancel");
      }
    };

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("order:new", onOrderEvent);
    socket.on("order:updated", onOrderEvent);
    socket.on("order:ready", onOrderEvent);
    socket.on("table:request_bill", onOrderEvent);
    socket.on("table:call_waiter", onOrderEvent);
    socket.on("order:cancelled", onOrderEvent);

    return () => {
      socket.off("order:new", onOrderEvent);
      socket.off("order:updated", onOrderEvent);
      socket.off("order:ready", onOrderEvent);
      socket.off("table:request_bill", onOrderEvent);
      socket.off("table:call_waiter", onOrderEvent);
      socket.off("order:cancelled", onOrderEvent);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [guestToken, table, showToast]);

  const scrollToCategory = useCallback((id: string) => {
    setActiveCategoryId(id);
    document.getElementById(`menu-section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    const chip = document.getElementById(`cat-chip-${id}`);
    chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const getCartQty = useCallback(
    (itemId: string) => cart.find((c) => c._id === itemId)?.quantity ?? 0,
    [cart]
  );

  const setItemQuantity = (item: MenuItem, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((c) => c._id !== item._id);
      }
      const existing = prev.find((c) => c._id === item._id);
      if (existing) {
        return prev.map((c) => (c._id === item._id ? { ...c, quantity } : c));
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const addToCart = (item: MenuItem) => {
    setItemQuantity(item, getCartQty(item._id) + 1);
  };

  const decrementFromCart = (item: MenuItem) => {
    setItemQuantity(item, getCartQty(item._id) - 1);
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c._id !== itemId));
  };

  const placeOrder = async () => {
    if (!table || cart.length === 0 || !guestToken) return;

    setPlacing(true);
    setError(null);

    try {
      const branchId = resolveBranchId(table.branchId);
      const res = await axios.post(
        `${API_URL}/api/v1/orders/guest`,
        {
          tableId: table._id,
          branchId,
          source: "qr",
          items: cart.map((c) => ({
            menuItemId: c._id,
            quantity: c.quantity,
            notes: c.notes,
          })),
        },
        { headers: { Authorization: `Bearer ${guestToken}` } }
      );

      const order = normalizeOrder(res.data.data);
      setActiveOrders((prev) => upsertOrder(prev, order));
      setCart([]);
      setCartOpen(false);
      showToast("Order placed! You'll get live updates here.");
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : "Failed to place order. Please try again.";
      setError(msg);
    } finally {
      setPlacing(false);
    }
  };

  const callWaiter = async (orderId: string) => {
    if (!guestToken) return;
    setActionLoading(orderId);
    try {
      await axios.post(
        `${API_URL}/api/v1/orders/${orderId}/call-waiter`,
        {},
        { headers: { Authorization: `Bearer ${guestToken}` } }
      );
      setActiveOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, callWaiter: true } : o))
      );
      showToast("Waiter has been notified");
    } catch {
      setError("Could not call waiter. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const requestBill = async (orderId: string) => {
    if (!guestToken) return;
    setActionLoading(`bill-${orderId}`);
    try {
      await axios.post(
        `${API_URL}/api/v1/orders/${orderId}/request-bill`,
        {},
        { headers: { Authorization: `Bearer ${guestToken}` } }
      );
      setActiveOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, requestBill: true } : o))
      );
      showToast("Bill request sent to staff");
    } catch {
      setError("Could not request bill. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmCancelOrder = async () => {
    if (!guestToken || !cancelModal) return;

    const orderId = cancelModal._id;
    setActionLoading(`cancel-${orderId}`);
    setError(null);

    try {
      const res = await axios.post(
        `${API_URL}/api/v1/orders/${orderId}/cancel`,
        { reason: "Cancelled by guest" },
        { headers: { Authorization: `Bearer ${guestToken}` } }
      );
      const normalized = normalizeOrder(res.data.data);
      setActiveOrders((prev) => upsertOrder(prev, normalized));
      setCancelModal(null);
      showToast(
        `Order ${cancelModal.orderNumber} was cancelled — ${cancelMessageForGuest(
          extractCancelReason(res.data.data)
        )}`,
        "cancel"
      );
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : "Could not cancel order. Please ask staff.";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const total = cart.reduce((s, c) => s + c.basePrice * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  const renderMenuRow = (item: MenuItem) => {
    const qty = getCartQty(item._id);

    return (
      <div
        key={item._id}
        className="group relative flex gap-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white/90 p-3 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm transition hover:border-amber-200/80 hover:shadow-md"
      >
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl shadow-inner ring-1 ring-black/5 sm:h-32 sm:w-32">
          <MenuDishPhoto
            src={item.image}
            alt={item.name}
            fallbackLetter={item.name.slice(0, 1).toUpperCase()}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold leading-snug text-stone-900">{item.name}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                  item.isVeg
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                    : "bg-rose-50 text-rose-800 ring-rose-200/80"
                }`}
              >
                {item.isVeg ? "Veg" : "Non-veg"}
              </span>
            </div>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500">
                {item.description}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-lg font-bold tabular-nums text-amber-700">
              {formatCurrency(item.basePrice)}
            </p>
            {qty === 0 ? (
              <button
                type="button"
                onClick={() => addToCart(item)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-orange-600/25 transition hover:from-amber-500 hover:to-orange-500 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50/90 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => decrementFromCart(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition hover:bg-white hover:shadow-sm"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums text-stone-900">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm transition hover:brightness-105 active:scale-95"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-stone-100 via-amber-50/30 to-stone-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="mt-5 text-sm font-medium text-stone-600">Preparing your menu…</p>
        </div>
      </div>
    );
  }

  if (error && !table) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-100 p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <XCircle className="h-7 w-7" />
          </div>
          <p className="font-semibold text-stone-900">We couldn’t open this table</p>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
          <p className="mt-4 text-xs text-stone-400">
            Scan a valid table QR code or ask staff for help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-gradient-to-b from-stone-100 via-amber-50/25 to-stone-100 text-stone-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-amber-200/35 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700/90">
                TechSan Bistro
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-stone-900">
                Table {table?.number || "…"}
              </h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Order from your seat · live kitchen updates
              </p>
            </div>
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 ${
                socketConnected
                  ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25"
                  : "bg-stone-200/80 text-stone-600 ring-stone-300"
              }`}
              title={socketConnected ? "Live updates on" : "Reconnecting…"}
            >
              {socketConnected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {socketConnected ? "Live" : "Offline"}
            </div>
          </div>

          {groups.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {groups.map((g) => (
                <button
                  key={g._id}
                  id={`cat-chip-${g._id}`}
                  type="button"
                  onClick={() => scrollToCategory(g._id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeCategoryId === g._id
                      ? "bg-stone-900 text-white shadow-md shadow-stone-900/20"
                      : "bg-white/90 text-stone-700 ring-1 ring-stone-200/90 hover:ring-amber-300/60"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4">
        {toast && (
          <div
            className={`mt-4 rounded-2xl border p-4 text-sm font-medium shadow-sm ${
              toast.variant === "cancel"
                ? "border-red-200/80 bg-red-50 text-red-900"
                : "border-emerald-200/80 bg-emerald-50 text-emerald-900"
            }`}
            role="status"
          >
            {toast.message}
          </div>
        )}

        {error && table && (
          <div className="mt-4 rounded-2xl border border-red-200/80 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {activeOrders.length > 0 && (
          <section className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">Your orders</h2>
              <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                {activeOrders.length} active
              </span>
            </div>
            {activeOrders.map((order) => (
              <article
                key={order._id}
                className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white/90 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
                  <div>
                    <p className="font-mono text-xs font-medium text-stone-400">
                      {order.orderNumber}
                    </p>
                    <span
                      className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        STATUS_STYLES[order.status] || STATUS_STYLES.pending
                      }`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-amber-700">
                    {formatCurrency(order.total)}
                  </p>
                </div>
                <ul className="divide-y divide-stone-100 px-4 py-2">
                  {order.items.map((line) => (
                    <li
                      key={line._id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span className="text-stone-800">
                        <span className="font-semibold tabular-nums text-stone-500">
                          {line.quantity}×
                        </span>{" "}
                        {line.name}
                      </span>
                      <span className="shrink-0 text-xs capitalize text-stone-400">
                        {line.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-stone-100 bg-stone-50/50 p-3">
                  <button
                    type="button"
                    disabled={order.callWaiter || actionLoading === order._id}
                    onClick={() => callWaiter(order._id)}
                    className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-amber-200 disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4 text-amber-600" />
                    {order.callWaiter ? "Waiter notified" : "Call waiter"}
                  </button>
                  <button
                    type="button"
                    disabled={order.requestBill || actionLoading === `bill-${order._id}`}
                    onClick={() => requestBill(order._id)}
                    className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-amber-200 disabled:opacity-50"
                  >
                    <Receipt className="h-4 w-4 text-amber-600" />
                    {order.requestBill ? "Bill requested" : "Request bill"}
                  </button>
                  {GUEST_CANCELLABLE.includes(order.status) && (
                    <button
                      type="button"
                      disabled={actionLoading === `cancel-${order._id}`}
                      onClick={() => setCancelModal(order)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-red-50/80 py-2.5 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel order
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        <WaitWhileCooking orders={activeOrders} />

        <section className="space-y-8 pb-40 pt-6">
          {groups.length === 0 ? (
            <p className="py-16 text-center text-sm text-stone-500">No dishes on the menu yet.</p>
          ) : (
            groups.map((group) => (
              <div key={group._id} id={`menu-section-${group._id}`} className="scroll-mt-40">
                <div className="mb-4 flex items-end justify-between gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-stone-900">{group.name}</h2>
                  <ChevronRight className="h-5 w-5 text-stone-300" aria-hidden />
                </div>
                <div className="space-y-3">
                  {group.items?.map(renderMenuRow)}
                  {group.subcategories?.map((sub) => (
                    <div key={sub._id} className="space-y-3 pt-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
                        <span className="h-px flex-1 bg-stone-200" />
                        {sub.name}
                        <span className="h-px flex-1 bg-stone-200" />
                      </h3>
                      <div className="space-y-3">{sub.items?.map(renderMenuRow)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {cancelModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 max-w-lg mx-auto cursor-default bg-black/45 backdrop-blur-[2px]"
            onClick={() => setCancelModal(null)}
            aria-label="Close dialog"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg p-4"
          >
            <div className="space-y-4 rounded-3xl border border-stone-200/90 bg-white p-6 shadow-2xl shadow-stone-900/15">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 id="cancel-order-title" className="text-lg font-bold text-stone-900">
                    Cancel this order?
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">
                    {cancelModal.orderNumber} · {formatCurrency(cancelModal.total)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-stone-500">
                    You can cancel while the kitchen has not started preparing. After that,
                    please ask staff.
                  </p>
                </div>
              </div>
              <ul className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                {cancelModal.items.map((line) => (
                  <li key={line._id} className="flex justify-between gap-2">
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModal(null)}
                  disabled={actionLoading === `cancel-${cancelModal._id}`}
                  className="flex-1 rounded-2xl border border-stone-200 py-3.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-50"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  onClick={confirmCancelOrder}
                  disabled={actionLoading === `cancel-${cancelModal._id}`}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:brightness-105 disabled:opacity-60"
                >
                  {actionLoading === `cancel-${cancelModal._id}` ? "Cancelling…" : "Yes, cancel"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {cart.length > 0 && (
        <>
          {cartOpen && (
            <button
              type="button"
              className="fixed inset-0 z-40 max-w-lg mx-auto bg-black/35 backdrop-blur-sm"
              onClick={() => setCartOpen(false)}
              aria-label="Close cart"
            />
          )}

          <div
            className={`fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg border-t border-stone-200/90 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all ${
              cartOpen ? "rounded-t-3xl" : ""
            }`}
          >
            {cartOpen && (
              <div className="max-h-[min(52vh,28rem)] overflow-y-auto border-b border-stone-100 px-4 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-900">Your cart</h3>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="text-sm font-semibold text-amber-700"
                  >
                    Done
                  </button>
                </div>
                <ul className="space-y-3">
                  {cart.map((line) => (
                    <li
                      key={line._id}
                      className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/80 p-3"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
                        <MenuDishPhoto
                          src={line.image}
                          alt={line.name}
                          fallbackLetter={line.name.slice(0, 1).toUpperCase()}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-stone-900">{line.name}</p>
                        <p className="text-xs text-stone-500">
                          {formatCurrency(line.basePrice)} × {line.quantity} ={" "}
                          <span className="font-semibold text-stone-800">
                            {formatCurrency(line.basePrice * line.quantity)}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemQuantity(line, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setItemQuantity(line, line.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line._id)}
                          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={() => setCartOpen(!cartOpen)}
                className="mb-2 w-full text-left text-sm font-semibold text-amber-800"
              >
                {cartOpen ? "Hide details" : `Review cart · ${itemCount} items`}
              </button>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-stone-500">Estimated total</span>
                <span className="text-2xl font-bold tabular-nums text-stone-900">
                  {formatCurrency(total)}
                </span>
              </div>
              <button
                type="button"
                onClick={placeOrder}
                disabled={placing}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-600/30 transition hover:brightness-105 disabled:opacity-60 active:scale-[0.99]"
              >
                {placing ? "Sending to kitchen…" : "Place order"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
