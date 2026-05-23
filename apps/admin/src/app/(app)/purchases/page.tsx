"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  CheckCircle,
  ClipboardList,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
}

interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  address?: string;
  paymentTerms?: string;
  isActive?: boolean;
}

interface InventoryOption {
  _id: string;
  name: string;
  unit: string;
  sku?: string;
  costPerUnit: number;
}

interface POItem {
  inventoryId: string | InventoryOption;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  expectedDelivery?: string;
  receivedAt?: string;
  createdAt: string;
  supplierId: Supplier | string;
  items: POItem[];
}

interface POLineForm {
  inventoryId: string;
  quantity: number;
  unitPrice: number;
}

type PageTab = "orders" | "suppliers";
type StatusFilter = "all" | "draft" | "ordered" | "received" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  ordered: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const emptyLine = (): POLineForm => ({
  inventoryId: "",
  quantity: 1,
  unitPrice: 0,
});

const emptySupplier = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "",
};

function invId(item: POItem): string {
  return typeof item.inventoryId === "object"
    ? item.inventoryId._id
    : String(item.inventoryId);
}

function invName(item: POItem): string {
  return typeof item.inventoryId === "object" ? item.inventoryId.name : "Item";
}

function supplierLabel(po: PurchaseOrder): string {
  return typeof po.supplierId === "object" ? po.supplierId.name : "—";
}

export default function PurchasesPage() {
  const [pageTab, setPageTab] = useState<PageTab>("orders");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poLines, setPoLines] = useState<POLineForm[]>([emptyLine()]);
  const [poExpected, setPoExpected] = useState("");
  const [submitAsOrdered, setSubmitAsOrdered] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    if (!branchId) return;
    const res = await api.get("/purchases/suppliers", { params: { branchId } });
    setSuppliers(res.data.data || []);
  }, [branchId]);

  const loadInventory = useCallback(async () => {
    if (!branchId) return;
    const res = await api.get("/inventory", { params: { branchId } });
    setInventory(res.data.data || []);
  }, [branchId]);

  const loadOrders = useCallback(async () => {
    if (!branchId) return;
    const params: Record<string, string> = { branchId };
    if (statusFilter !== "all") params.status = statusFilter;
    const res = await api.get("/purchases", { params });
    setOrders(res.data.data || []);
  }, [branchId, statusFilter]);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadOrders(), loadSuppliers(), loadInventory()]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load purchases";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, loadOrders, loadSuppliers, loadInventory]);

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
      localStorage.setItem("branchId", branchId);
      refresh();
    }
  }, [branchId, refresh]);

  const stats = useMemo(() => {
    const draft = orders.filter((o) => o.status === "draft").length;
    const ordered = orders.filter((o) => o.status === "ordered").length;
    const pendingValue = orders
      .filter((o) => o.status === "ordered")
      .reduce((s, o) => s + o.totalAmount, 0);
    return { draft, ordered, pendingValue };
  }, [orders]);

  const poLineTotal = (line: POLineForm) => line.quantity * line.unitPrice;
  const poTotal = poLines.reduce((s, l) => s + poLineTotal(l), 0);

  const openNewPo = () => {
    setEditingPoId(null);
    setPoSupplierId(suppliers[0]?._id || "");
    setPoLines([emptyLine()]);
    setPoExpected("");
    setSubmitAsOrdered(false);
    setPoModalOpen(true);
  };

  const openEditPo = (po: PurchaseOrder) => {
    setEditingPoId(po._id);
    setPoSupplierId(typeof po.supplierId === "object" ? po.supplierId._id : String(po.supplierId));
    setPoLines(
      po.items.map((item) => ({
        inventoryId: invId(item),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    );
    setPoExpected(po.expectedDelivery ? po.expectedDelivery.slice(0, 10) : "");
    setSubmitAsOrdered(false);
    setPoModalOpen(true);
  };

  const onInventoryPick = (index: number, inventoryId: string) => {
    const item = inventory.find((i) => i._id === inventoryId);
    setPoLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              inventoryId,
              unitPrice: item?.costPerUnit ?? line.unitPrice,
            }
          : line
      )
    );
  };

  const savePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !poSupplierId) {
      alert("Select a supplier");
      return;
    }
    const items = poLines.filter((l) => l.inventoryId && l.quantity > 0);
    if (items.length === 0) {
      alert("Add at least one line item");
      return;
    }

    setSaving(true);
    try {
      if (editingPoId) {
        await api.patch(`/purchases/${editingPoId}`, {
          supplierId: poSupplierId,
          items,
          expectedDelivery: poExpected || undefined,
        });
      } else {
        await api.post("/purchases", {
          branchId,
          supplierId: poSupplierId,
          items,
          expectedDelivery: poExpected || undefined,
          status: submitAsOrdered ? "ordered" : "draft",
        });
      }
      setPoModalOpen(false);
      await loadOrders();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save purchase order";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: "submit" | "receive" | "cancel" | "delete",
    confirmMsg?: string
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionId(id);
    try {
      if (action === "delete") {
        await api.delete(`/purchases/${id}`);
      } else {
        await api.post(`/purchases/${id}/${action}`);
      }
      await Promise.all([loadOrders(), loadInventory()]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Action failed";
      alert(message);
    } finally {
      setActionId(null);
    }
  };

  const openNewSupplier = () => {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplier);
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s._id);
    setSupplierForm({
      name: s.name,
      contactPerson: s.contactPerson || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      paymentTerms: s.paymentTerms || "",
    });
    setSupplierModalOpen(true);
  };

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSupplierId) {
        await api.patch(`/purchases/suppliers/${editingSupplierId}`, supplierForm, {
          params: { branchId },
        });
      } else {
        await api.post("/purchases/suppliers", { ...supplierForm, branchId });
      }
      setSupplierModalOpen(false);
      await loadSuppliers();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save supplier";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="text-orange-600" size={28} />
            Purchase management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create purchase orders, receive stock, and manage suppliers
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
            className="p-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          {pageTab === "orders" ? (
            <button
              type="button"
              onClick={openNewPo}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              <Plus size={16} />
              New PO
            </button>
          ) : (
            <button
              type="button"
              onClick={openNewSupplier}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              <Plus size={16} />
              Add supplier
            </button>
          )}
        </div>
      </div>

      <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden mb-6 w-fit">
        {(
          [
            ["orders", "Purchase orders", ClipboardList],
            ["suppliers", "Suppliers", Truck],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPageTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${
              pageTab === id
                ? "bg-orange-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {pageTab === "orders" ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Draft POs</p>
              <p className="text-2xl font-bold mt-1">{stats.draft}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Awaiting delivery</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{stats.ordered}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase">Ordered value</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {formatCurrency(stats.pendingValue)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "draft", "ordered", "received", "cancelled"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                  statusFilter === s
                    ? "bg-orange-600 text-white"
                    : "bg-white dark:bg-slate-900 border dark:border-slate-700"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-slate-500 text-center py-12">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No purchase orders yet</p>
          ) : (
            <div className="space-y-4">
              {orders.map((po) => (
                <div
                  key={po._id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold font-mono">{po.poNumber}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[po.status] || STATUS_COLORS.draft
                          }`}
                        >
                          {STATUS_LABELS[po.status] || po.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {supplierLabel(po)}
                        {po.expectedDelivery && po.status === "ordered" && (
                          <span>
                            {" "}
                            · Expected{" "}
                            {new Date(po.expectedDelivery).toLocaleDateString()}
                          </span>
                        )}
                        {po.receivedAt && (
                          <span>
                            {" "}
                            · Received {new Date(po.receivedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-orange-600">
                      {formatCurrency(po.totalAmount)}
                    </p>
                  </div>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-3">
                    {po.items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span>
                          {item.quantity}× {invName(item)}
                        </span>
                        <span>{formatCurrency(item.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {po.status === "draft" && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditPo(po)}
                          className="text-sm px-3 py-1.5 border rounded-lg flex items-center gap-1 hover:bg-slate-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={actionId === po._id}
                          onClick={() =>
                            runAction(po._id, "submit", `Submit ${po.poNumber} to supplier?`)
                          }
                          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Submit order
                        </button>
                        <button
                          type="button"
                          disabled={actionId === po._id}
                          onClick={() => runAction(po._id, "delete", `Delete ${po.poNumber}?`)}
                          className="text-sm px-3 py-1.5 border border-red-200 text-red-700 rounded-lg flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </>
                    )}
                    {po.status === "ordered" && (
                      <>
                        <button
                          type="button"
                          disabled={actionId === po._id}
                          onClick={() =>
                            runAction(
                              po._id,
                              "receive",
                              `Receive ${po.poNumber} and add stock to inventory?`
                            )
                          }
                          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <PackageCheck size={14} />
                          {actionId === po._id ? "Receiving..." : "Receive goods"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === po._id}
                          onClick={() => runAction(po._id, "cancel", `Cancel ${po.poNumber}?`)}
                          className="text-sm px-3 py-1.5 border border-red-200 text-red-700 rounded-lg flex items-center gap-1"
                        >
                          <XCircle size={14} />
                          Cancel
                        </button>
                      </>
                    )}
                    {po.status === "received" && (
                      <span className="text-sm text-green-700 flex items-center gap-1">
                        <CheckCircle size={14} />
                        Stock updated in inventory
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : loading ? (
        <p className="text-slate-500 text-center py-12">Loading...</p>
      ) : suppliers.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No suppliers yet. Add your first supplier.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div
              key={s._id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-semibold">{s.name}</p>
                <button
                  type="button"
                  onClick={() => openEditSupplier(s)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil size={16} />
                </button>
              </div>
              {s.contactPerson && (
                <p className="text-sm text-slate-500 mt-1">{s.contactPerson}</p>
              )}
              {s.phone && <p className="text-sm text-slate-500">{s.phone}</p>}
              {s.email && <p className="text-sm text-slate-500">{s.email}</p>}
              {s.paymentTerms && (
                <p className="text-xs text-slate-400 mt-2">Terms: {s.paymentTerms}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {poModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingPoId ? "Edit purchase order" : "New purchase order"}
            </h2>
            <form onSubmit={savePo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier *</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expected delivery</label>
                <input
                  type="date"
                  value={poExpected}
                  onChange={(e) => setPoExpected(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Line items *</label>
                  <button
                    type="button"
                    onClick={() => setPoLines((prev) => [...prev, emptyLine()])}
                    className="text-sm text-orange-600 hover:underline"
                  >
                    + Add line
                  </button>
                </div>
                <div className="space-y-3">
                  {poLines.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 dark:border-slate-700"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <label className="text-xs text-slate-500">Inventory item</label>
                        <select
                          value={line.inventoryId}
                          onChange={(e) => onInventoryPick(index, e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-700"
                          required
                        >
                          <option value="">Select item</option>
                          {inventory.map((inv) => (
                            <option key={inv._id} value={inv._id}>
                              {inv.name} ({inv.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="text-xs text-slate-500">Qty</label>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={line.quantity}
                          onChange={(e) =>
                            setPoLines((prev) =>
                              prev.map((l, i) =>
                                i === index ? { ...l, quantity: Number(e.target.value) } : l
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <label className="text-xs text-slate-500">Unit price</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setPoLines((prev) =>
                              prev.map((l, i) =>
                                i === index ? { ...l, unitPrice: Number(e.target.value) } : l
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 border rounded text-sm dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 text-sm font-medium text-right pb-2">
                        {formatCurrency(poLineTotal(line))}
                      </div>
                      <div className="col-span-1">
                        {poLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPoLines((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-right font-bold mt-2">Total: {formatCurrency(poTotal)}</p>
              </div>
              {!editingPoId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={submitAsOrdered}
                    onChange={(e) => setSubmitAsOrdered(e.target.checked)}
                  />
                  Submit to supplier immediately (skip draft)
                </label>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPoModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingPoId ? "Update draft" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingSupplierId ? "Edit supplier" : "Add supplier"}
            </h2>
            <form onSubmit={saveSupplier} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact person</label>
                <input
                  value={supplierForm.contactPerson}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contactPerson: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment terms</label>
                <input
                  value={supplierForm.paymentTerms}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })
                  }
                  placeholder="e.g. Net 30"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
