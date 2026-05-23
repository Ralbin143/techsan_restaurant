"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Pencil, Plus, QrCode, Trash2, RefreshCw } from "lucide-react";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface DiningArea {
  _id: string;
  name: string;
}

interface TableRow {
  _id: string;
  number: string;
  capacity: number;
  status: string;
  qrCode?: string;
  qrToken?: string;
  isActive?: boolean;
  diningAreaId?: DiningArea | string;
}

const STATUSES = ["available", "occupied", "reserved", "cleaning"] as const;

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  occupied: "bg-red-100 text-red-700 border-red-200",
  reserved: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cleaning: "bg-slate-100 text-slate-700 border-slate-200",
};

const emptyForm = {
  number: "",
  capacity: 4,
  diningAreaId: "",
  status: "available" as (typeof STATUSES)[number],
};

export default function TablesPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [qrModal, setQrModal] = useState<TableRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newAreaName, setNewAreaName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTables = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, areasRes] = await Promise.all([
        api.get("/tables/live", { params: { branchId } }),
        api.get("/tables/areas", { params: { branchId } }),
      ]);
      setTables(tablesRes.data.data);
      setAreas(areasRes.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load tables";
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
      loadTables();
    }
  }, [branchId, loadTables]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      diningAreaId: areas[0]?._id || "",
    });
    setModalOpen(true);
  };

  const openEdit = (table: TableRow) => {
    setEditingId(table._id);
    setForm({
      number: table.number,
      capacity: table.capacity,
      diningAreaId:
        typeof table.diningAreaId === "object"
          ? table.diningAreaId._id
          : (table.diningAreaId as string),
      status: table.status as (typeof STATUSES)[number],
    });
    setModalOpen(true);
  };

  const saveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, branchId };
      if (editingId) {
        await api.patch(`/tables/${editingId}`, payload);
      } else {
        await api.post("/tables", payload);
      }
      setModalOpen(false);
      await loadTables();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save table";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTable = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    try {
      await api.delete(`/tables/${id}`);
      await loadTables();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to delete table";
      alert(message);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/tables/${id}/status`, { status });
      await loadTables();
    } catch {
      alert("Failed to update status");
    }
  };

  const regenerateQr = async (table: TableRow) => {
    try {
      const res = await api.post(`/tables/${table._id}/qr`);
      setQrModal(res.data.data);
      await loadTables();
    } catch {
      alert("Failed to generate QR code");
    }
  };

  const addArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    setSaving(true);
    try {
      await api.post("/tables/areas", { branchId, name: newAreaName.trim() });
      setNewAreaName("");
      setAreaModalOpen(false);
      await loadTables();
    } catch {
      alert("Failed to create dining area");
    } finally {
      setSaving(false);
    }
  };

  const areaName = (table: TableRow) => {
    if (typeof table.diningAreaId === "object" && table.diningAreaId?.name) {
      return table.diningAreaId.name;
    }
    return areas.find((a) => a._id === table.diningAreaId)?.name || "—";
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Table Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700"
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadTables}
            className="p-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setAreaModalOpen(true)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            Add Area
          </button>
          <button
            onClick={openAdd}
            disabled={!areas.length}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} />
            Add Table
          </button>
        </div>
      </div>

      {areas.length === 0 && !loading && (
        <p className="mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          Create a dining area first (e.g. Main Hall, Patio), then add tables.
        </p>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={loadTables} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading tables...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => (
            <div
              key={table._id}
              className={`bg-white dark:bg-slate-900 rounded-xl p-4 border-2 text-center ${
                statusColors[table.status]?.split(" ")[2] || "border-slate-200"
              } dark:border-slate-700`}
            >
              <p className="text-2xl font-bold">{table.number}</p>
              <p className="text-xs text-slate-500 mt-1">{areaName(table)}</p>
              <select
                value={table.status}
                onChange={(e) => setStatus(table._id, e.target.value)}
                className={`mt-2 w-full text-xs rounded-full px-2 py-1 border-0 capitalize cursor-pointer ${
                  statusColors[table.status] || ""
                }`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-xs mt-2 text-slate-400">{table.capacity} seats</p>
              <div className="flex justify-center gap-1 mt-3">
                <button
                  onClick={() => openEdit(table)}
                  className="p-2 text-slate-500 hover:text-orange-600 rounded-lg hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => regenerateQr(table)}
                  className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                  title="QR Code"
                >
                  <QrCode size={16} />
                </button>
                <button
                  onClick={() => deleteTable(table._id)}
                  className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit Table" : "Add Table"}
            </h2>
            <form onSubmit={saveTable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Table number</label>
                <input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="T1, A5, etc."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dining area</label>
                <select
                  value={form.diningAreaId}
                  onChange={(e) => setForm({ ...form, diningAreaId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                >
                  {areas.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm({ ...form, capacity: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as (typeof STATUSES)[number],
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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

      {areaModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Dining Area</h2>
            <form onSubmit={addArea} className="space-y-4">
              <input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="e.g. Main Hall, Rooftop"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                required
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAreaModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrModal?.qrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-xl text-center max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2">Table {qrModal.number} — QR Code</h2>
            <p className="text-xs text-slate-500 mb-4">Customers scan to order</p>
            <img
              src={qrModal.qrCode}
              alt={`QR for table ${qrModal.number}`}
              className="mx-auto w-48 h-48"
            />
            <p className="text-xs text-slate-400 mt-3 break-all">
              {typeof window !== "undefined" &&
                `${window.location.origin}/order/${qrModal.qrToken}`}
            </p>
            <button
              onClick={() => setQrModal(null)}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

