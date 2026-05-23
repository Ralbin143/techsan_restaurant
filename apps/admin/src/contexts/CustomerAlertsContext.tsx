"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { createSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import {
  alertMessage,
  normalizeSocketOrder,
  orderBranchId,
  type CustomerAlert,
  type CustomerAlertType,
  type SocketOrder,
} from "@/lib/orderSocket";
import { Bell, Receipt, Wifi, WifiOff, X, XCircle } from "lucide-react";

type OrderListener = (order: SocketOrder, event: string) => void;

interface CustomerAlertsContextValue {
  connected: boolean;
  requestCount: number;
  alerts: CustomerAlert[];
  dismissAlert: (id: string) => void;
  registerOrderListener: (fn: OrderListener) => () => void;
  refreshRequestCount: (branchId: string) => Promise<void>;
}

const CustomerAlertsContext = createContext<CustomerAlertsContextValue | null>(null);

const ALERT_ICONS: Record<CustomerAlertType, typeof Bell> = {
  call_waiter: Bell,
  request_bill: Receipt,
  cancel_order: XCircle,
};

const ALERT_STYLES: Record<CustomerAlertType, string> = {
  call_waiter: "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
  request_bill: "bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100",
  cancel_order: "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200",
};

const CANCEL_ALERT_AUTO_DISMISS_MS = 10_000;
const ALERT_DEDUPE_MS = 3_000;

function shouldAutoDismissAlert(alert: CustomerAlert, order: SocketOrder): boolean {
  if (alert.order._id !== order._id) return false;
  if (order.status === "completed") return true;
  if (alert.type === "call_waiter" && !order.callWaiter) return true;
  if (alert.type === "request_bill" && !order.requestBill) return true;
  return false;
}

export function CustomerAlertsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [branchId, setBranchId] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Set<OrderListener>>(new Set());
  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const recentAlertKeysRef = useRef<Map<string, number>>(new Map());

  const registerOrderListener = useCallback((fn: OrderListener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const notifyListeners = useCallback((order: SocketOrder, event: string) => {
    listenersRef.current.forEach((fn) => fn(order, event));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimersRef.current.delete(id);
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dismissResolvedAlerts = useCallback((order: SocketOrder) => {
    setAlerts((prev) => {
      const toRemove = prev.filter((a) => shouldAutoDismissAlert(a, order));
      toRemove.forEach((a) => {
        const timer = dismissTimersRef.current.get(a.id);
        if (timer) {
          clearTimeout(timer);
          dismissTimersRef.current.delete(a.id);
        }
      });
      return prev.filter((a) => !shouldAutoDismissAlert(a, order));
    });
  }, []);

  const pushAlert = useCallback(
    (type: CustomerAlertType, order: SocketOrder) => {
      const dedupeKey = `${type}:${order._id}`;
      const now = Date.now();
      const lastSeen = recentAlertKeysRef.current.get(dedupeKey);
      if (lastSeen != null && now - lastSeen < ALERT_DEDUPE_MS) {
        return;
      }
      recentAlertKeysRef.current.set(dedupeKey, now);

      const alert: CustomerAlert = {
        id: `${type}-${order._id}-${now}`,
        type,
        message: alertMessage(type, order),
        order,
        at: new Date().toISOString(),
      };
      setAlerts((prev) => {
        const duplicate = prev.some(
          (a) => a.type === type && a.order._id === order._id
        );
        if (duplicate) return prev;
        return [alert, ...prev].slice(0, 8);
      });

      if (type === "cancel_order") {
        const timer = setTimeout(() => dismissAlert(alert.id), CANCEL_ALERT_AUTO_DISMISS_MS);
        dismissTimersRef.current.set(alert.id, timer);
      }
    },
    [dismissAlert]
  );

  const refreshRequestCount = useCallback(async (bid: string) => {
    if (!bid) return;
    try {
      const { api } = await import("@/lib/api");
      const res = await api.get("/orders", {
        params: { branchId: bid, hasServiceRequest: "true", limit: "1" },
      });
      setRequestCount(res.data.pagination?.total ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  const handleOrder = useCallback(
    (raw: Record<string, unknown>, event: string) => {
      const order = normalizeSocketOrder(raw);
      const bid = branchIdRef.current;
      if (bid && orderBranchId(order) && orderBranchId(order) !== bid) {
        return;
      }

      notifyListeners(order, event);

      dismissResolvedAlerts(order);

      if (order.callWaiter || order.requestBill) {
        setRequestCount((c) => Math.max(c, 1));
      }
      if (order.status === "cancelled" || (!order.callWaiter && !order.requestBill)) {
        refreshRequestCount(bid);
      }
    },
    [notifyListeners, refreshRequestCount, dismissResolvedAlerts]
  );

  useEffect(() => {
    const readBranch = () => setBranchId(localStorage.getItem("branchId") || "");
    readBranch();
    const onBranch = (e: Event) => {
      const detail = (e as CustomEvent<{ branchId: string }>).detail;
      setBranchId(detail?.branchId || localStorage.getItem("branchId") || "");
    };
    window.addEventListener("branch-changed", onBranch);
    window.addEventListener("storage", readBranch);
    return () => {
      window.removeEventListener("branch-changed", onBranch);
      window.removeEventListener("storage", readBranch);
    };
  }, []);

  useEffect(() => {
    if (branchId) refreshRequestCount(branchId);
  }, [branchId, refreshRequestCount]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    const socket = createSocket(token);
    socketRef.current = socket;

    const joinBranch = () => {
      const bid = localStorage.getItem("branchId");
      if (bid && socket.connected) socket.emit("join:branch", bid);
    };

    socket.on("connect", () => {
      setConnected(true);
      joinBranch();
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("customer:alert", (payload: {
      type: CustomerAlertType;
      order: Record<string, unknown>;
    }) => {
      const order = normalizeSocketOrder(payload.order || {});
      const bid = branchIdRef.current;
      if (bid && orderBranchId(order) && orderBranchId(order) !== bid) return;
      pushAlert(payload.type, order);
      handleOrder(payload.order || {}, `customer:${payload.type}`);
    });

    socket.on("table:call_waiter", (o: Record<string, unknown>) =>
      handleOrder(o, "table:call_waiter")
    );
    socket.on("table:request_bill", (o: Record<string, unknown>) =>
      handleOrder(o, "table:request_bill")
    );
    socket.on("order:cancelled", (o: Record<string, unknown>) =>
      handleOrder(o, "order:cancelled")
    );
    socket.on("order:new", (o: Record<string, unknown>) => handleOrder(o, "order:new"));
    socket.on("order:updated", (o: Record<string, unknown>) =>
      handleOrder(o, "order:updated")
    );
    socket.on("order:ready", (o: Record<string, unknown>) => handleOrder(o, "order:ready"));
    socket.on("payment:completed", (payload: { order?: Record<string, unknown> }) => {
      if (payload?.order) handleOrder(payload.order, "payment:completed");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      dismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, [handleOrder, pushAlert]);

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach((timer) => clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.connected && branchId) {
      socket.emit("join:branch", branchId);
    }
  }, [branchId]);

  const showBanner =
    !!pathname &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/order");

  return (
    <CustomerAlertsContext.Provider
      value={{
        connected,
        requestCount,
        alerts,
        dismissAlert,
        registerOrderListener,
        refreshRequestCount,
      }}
    >
      {showBanner && (
        <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-3 max-w-sm w-full pointer-events-none">
          <div
            className={`pointer-events-auto self-end flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shadow ${
              connected
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Reconnecting…"}
          </div>
          {alerts.map((alert) => {
            const Icon = ALERT_ICONS[alert.type];
            return (
              <div
                key={alert.id}
                className={`pointer-events-auto flex items-start gap-2 p-3 rounded-lg border shadow-lg ${ALERT_STYLES[alert.type]}`}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{alert.message}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {new Date(alert.at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(alert.id)}
                  className="shrink-0 p-0.5 opacity-60 hover:opacity-100"
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {children}
    </CustomerAlertsContext.Provider>
  );
}

export function useCustomerAlerts() {
  const ctx = useContext(CustomerAlertsContext);
  if (!ctx) throw new Error("useCustomerAlerts must be used within CustomerAlertsProvider");
  return ctx;
}
