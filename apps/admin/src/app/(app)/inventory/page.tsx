"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Supplier {
  _id: string;
  name: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  costPerUnit: number;
  valuation: number;
  consumptionPerServing?: number;
  supplierId?: Supplier | string | null;
}

type StockFilter = "all" | "low" | "out";
type StockAdjustType = "in" | "out" | "waste" | "adjustment";

const UNITS = ["kg", "g", "L", "ml", "pcs", "pack", "box", "bottle"];

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  unit: "kg",
  currentStock: 0,
  minStock: 0,
  maxStock: "" as number | "",
  costPerUnit: 0,
  consumptionPerServing: 0,
  supplierId: "",
};

function stockStatus(item: InventoryItem): "ok" | "low" | "out" {
  if (item.currentStock <= 0) return "out";
  if (item.currentStock <= item.minStock) return "low";
  return "ok";
}

function supplierName(item: InventoryItem): string {
  if (!item.supplierId) return "—";
  return typeof item.supplierId === "object" ? item.supplierId.name : "—";
}

export default function InventoryPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [stockModal, setStockModal] = useState<InventoryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockType, setStockType] = useState<StockAdjustType>("in");
  const [stockQty, setStockQty] = useState(0);
  const [stockReason, setStockReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [invRes, supRes] = await Promise.all([
        api.get("/inventory", { params: { branchId } }),
        api.get("/inventory/suppliers"),
      ]);
      setItems(invRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load inventory";
      setError(message);
    } finally {
      setLoading(false);
    }
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
      localStorage.setItem("branchId", branchId);
      loadInventory();
    }
  }, [branchId, loadInventory]);

  const stats = useMemo(() => {
    const low = items.filter((i) => stockStatus(i) === "low").length;
    const out = items.filter((i) => stockStatus(i) === "out").length;
    const valuation = items.reduce((s, i) => s + (i.valuation ?? i.currentStock * i.costPerUnit), 0);
    return { total: items.length, low, out, valuation };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = stockStatus(item);
      if (filter === "low" && status !== "low") return false;
      if (filter === "out" && status !== "out") return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setItemModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      sku: item.sku || "",
      barcode: item.barcode || "",
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      maxStock: item.maxStock ?? "",
      costPerUnit: item.costPerUnit,
      consumptionPerServing: item.consumptionPerServing ?? 0,
      supplierId:
        typeof item.supplierId === "object" && item.supplierId
          ? item.supplierId._id
          : (item.supplierId as string) || "",
    });
    setItemModalOpen(true);
  };

  const openStock = (item: InventoryItem) => {
    setStockModal(item);
    setStockType("in");
    setStockQty(0);
    setStockReason("");
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setSaving(true);
    try {
      const payload = {
        branchId,
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStock: Number(form.minStock),
        maxStock: form.maxStock === "" ? undefined : Number(form.maxStock),
        costPerUnit: Number(form.costPerUnit),
        consumptionPerServing: Number(form.consumptionPerServing),
        supplierId: form.supplierId || undefined,
      };

      if (editingId) {
        await api.patch(`/inventory/${editingId}`, payload);
      } else {
        await api.post("/inventory", payload);
      }
      setItemModalOpen(false);
      await loadInventory();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save item";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
    try {
      await api.delete(`/inventory/${item._id}`);
      await loadInventory();
    } catch {
      alert("Failed to delete item");
    }
  };

  const adjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    setSaving(true);
    try {
      const res = await api.post(`/inventory/${stockModal._id}/stock`, {
        type: stockType,
        quantity: Number(stockQty),
        reason: stockReason.trim(),
        branchId,
      });
      const updated = res.data.data?.inventory;
      if (updated?._id) {
        setItems((prev) =>
          prev.map((i) => (i._id === updated._id ? { ...i, ...updated } : i))
        );
      } else {
        await loadInventory();
      }
      setStockModal(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to adjust stock";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (item: InventoryItem) => {
    const status = stockStatus(item);
    if (status === "out") {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
          <AlertTriangle size={12} />
          Out of stock
        </span>
      );
    }
    if (status === "low") {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          <AlertTriangle size={12} />
          Low stock
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">In stock</span>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="text-orange-600" size={28} />
            Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track stock levels and adjustments by branch</p>
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
            onClick={loadInventory}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            <Plus size={16} />
            Add item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total items</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Low stock</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{stats.low}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Out of stock</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{stats.out}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total valuation</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(stats.valuation)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU, unit..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
        <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden shrink-0">
          {(
            [
              ["all", "All"],
              ["low", `Low (${stats.low})`],
              ["out", `Out (${stats.out})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-4 py-2.5 text-sm font-medium ${
                filter === id
                  ? "bg-orange-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 text-center py-12">Loading inventory...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-slate-400 text-center py-12">
          {items.length === 0
            ? "No inventory items yet. Add your first item."
            : "No items match your filters."}
        </p>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3 font-medium">Item</th>
                  <th className="text-left p-3 font-medium">SKU</th>
                  <th className="text-right p-3 font-medium">Stock</th>
                  <th className="text-right p-3 font-medium">Min</th>
                  <th className="text-right p-3 font-medium">Cost/unit</th>
                  <th className="text-right p-3 font-medium">Value</th>
                  <th className="text-left p-3 font-medium">Supplier</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item._id}
                    className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-slate-500 font-mono text-xs">{item.sku || "—"}</td>
                    <td className="p-3 text-right">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="p-3 text-right text-slate-500">
                      {item.minStock} {item.unit}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(item.costPerUnit)}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.valuation ?? item.currentStock * item.costPerUnit)}
                    </td>
                    <td className="p-3 text-slate-500">{supplierName(item)}</td>
                    <td className="p-3">{statusBadge(item)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openStock(item)}
                          title="Adjust stock"
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-green-700"
                        >
                          <ArrowUpCircle size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(item)}
                          title="Delete"
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit inventory item" : "Add inventory item"}
            </h2>
            <form onSubmit={saveItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit *</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Current stock</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.currentStock}
                    onChange={(e) =>
                      setForm({ ...form, currentStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min stock</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Cost per unit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.costPerUnit}
                    onChange={(e) =>
                      setForm({ ...form, costPerUnit: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max stock</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.maxStock}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maxStock: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              {suppliers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="">None</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-1">Adjust stock</h2>
            <p className="text-sm text-slate-500 mb-4">
              {stockModal.name} · current: {stockModal.currentStock} {stockModal.unit}
            </p>
            <form onSubmit={adjustStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["in", "Stock in", ArrowUpCircle],
                    ["out", "Stock out", ArrowDownCircle],
                    ["waste", "Waste", Trash2],
                    ["adjustment", "Set level", Package],
                  ] as const
                ).map(([type, label, Icon]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setStockType(type)}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-sm font-medium ${
                      stockType === type
                        ? "border-orange-600 bg-orange-50 text-orange-700 dark:bg-orange-950"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {stockType === "adjustment" ? "New stock level" : "Quantity"}
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={stockQty}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <input
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="e.g. Weekly delivery, spoilage"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setStockModal(null)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
