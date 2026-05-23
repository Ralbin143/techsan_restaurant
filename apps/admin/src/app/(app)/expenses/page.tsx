"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  CheckCircle,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
}

interface UserRef {
  firstName: string;
  lastName?: string;
}

interface Expense {
  _id: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  vendor?: string;
  referenceNumber?: string;
  status: string;
  notes?: string;
  createdBy?: UserRef;
  paidAt?: string;
}

interface ExpenseSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  count: number;
  byCategory: { _id: string; total: number; count: number }[];
}

type StatusFilter = "all" | "pending" | "approved" | "paid" | "rejected" | "cancelled";
type CategoryFilter =
  | "all"
  | "utilities"
  | "rent"
  | "payroll"
  | "supplies"
  | "marketing"
  | "maintenance"
  | "equipment"
  | "insurance"
  | "taxes"
  | "other";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "utilities", label: "Utilities" },
  { value: "rent", label: "Rent" },
  { value: "payroll", label: "Payroll" },
  { value: "supplies", label: "Supplies" },
  { value: "marketing", label: "Marketing" },
  { value: "maintenance", label: "Maintenance" },
  { value: "equipment", label: "Equipment" },
  { value: "insurance", label: "Insurance" },
  { value: "taxes", label: "Taxes" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
};

const emptyForm = {
  title: "",
  description: "",
  category: "other" as CategoryFilter,
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "bank_transfer",
  vendor: "",
  referenceNumber: "",
  notes: "",
  recordAsPaid: false,
};

function monthRange() {
  const from = new Date();
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  };
}

function labelCategory(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label || cat;
}

export default function ExpensesPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dateFrom, setDateFrom] = useState(() => monthRange().from);
  const [dateTo, setDateTo] = useState(() => monthRange().to);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!branchId) return;
    const res = await api.get("/expenses/summary", {
      params: { branchId, from: dateFrom, to: dateTo },
    });
    setSummary(res.data.data);
  }, [branchId, dateFrom, dateTo]);

  const loadExpenses = useCallback(async () => {
    if (!branchId) return;
    const params: Record<string, string> = { branchId, from: dateFrom, to: dateTo };
    if (statusFilter !== "all") params.status = statusFilter;
    if (categoryFilter !== "all") params.category = categoryFilter;
    if (search.trim()) params.search = search.trim();
    const res = await api.get("/expenses", { params });
    setExpenses(res.data.data || []);
  }, [branchId, statusFilter, categoryFilter, dateFrom, dateTo, search]);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadExpenses(), loadSummary()]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load expenses";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, loadExpenses, loadSummary]);

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

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("branchId", branchId);
      refresh();
    }
  }, [branchId, refresh]);

  const pendingCount = useMemo(
    () => expenses.filter((e) => e.status === "pending").length,
    [expenses]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, expenseDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingId(exp._id);
    setForm({
      title: exp.title,
      description: exp.description || "",
      category: exp.category as CategoryFilter,
      amount: exp.amount,
      expenseDate: exp.expenseDate.slice(0, 10),
      paymentMethod: exp.paymentMethod,
      vendor: exp.vendor || "",
      referenceNumber: exp.referenceNumber || "",
      notes: exp.notes || "",
      recordAsPaid: false,
    });
    setModalOpen(true);
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setSaving(true);
    try {
      const payload = {
        branchId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category === "all" ? "other" : form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        vendor: form.vendor.trim(),
        referenceNumber: form.referenceNumber.trim(),
        notes: form.notes.trim(),
        status: form.recordAsPaid ? "paid" : undefined,
      };

      if (editingId) {
        await api.patch(`/expenses/${editingId}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      setModalOpen(false);
      await refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save expense";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: string) => {
    setActionId(id);
    try {
      await api.post(`/expenses/${id}/${action}`);
      await refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Action failed";
      alert(message);
    } finally {
      setActionId(null);
    }
  };

  const deleteExpense = async (exp: Expense) => {
    if (!window.confirm(`Delete "${exp.title}"?`)) return;
    setActionId(exp._id);
    try {
      await api.delete(`/expenses/${exp._id}`);
      await refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to delete";
      alert(message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="text-orange-600" size={28} />
            Expense management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track operating costs, approvals, and payments
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
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            <Plus size={16} />
            Add expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Total (period)</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(summary?.totalAmount || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Paid</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {formatCurrency(summary?.paidAmount || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Pending payment</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">
            {formatCurrency(summary?.pendingAmount || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Awaiting approval</p>
          <p className="text-2xl font-bold mt-1">{pendingCount}</p>
        </div>
      </div>

      {summary?.byCategory?.length ? (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <h2 className="font-semibold text-sm mb-3">Spending by category</h2>
          <div className="flex flex-wrap gap-2">
            {summary.byCategory.map((row) => (
              <span
                key={row._id}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
              >
                {labelCategory(row._id)}: {formatCurrency(row.total)} ({row.count})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            placeholder="Search title, vendor, reference..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "approved", "paid", "rejected", "cancelled"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              statusFilter === s ? "bg-orange-600 text-white" : "border dark:border-slate-700"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          type="button"
          onClick={refresh}
          className="ml-auto text-sm text-orange-600 hover:underline"
        >
          Apply filters
        </button>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500 text-center py-12">Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No expenses found</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Expense</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Vendor</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp._id} className="border-b dark:border-slate-800 last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{exp.title}</p>
                      {exp.referenceNumber && (
                        <p className="text-xs text-slate-500">Ref: {exp.referenceNumber}</p>
                      )}
                    </td>
                    <td className="p-3 capitalize">{labelCategory(exp.category)}</td>
                    <td className="p-3 text-slate-500">{exp.vendor || "—"}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(exp.amount)}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[exp.status] || ""}`}
                      >
                        {STATUS_LABELS[exp.status] || exp.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {exp.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={actionId === exp._id}
                              onClick={() => runAction(exp._id, "approve")}
                              className="p-2 rounded-lg hover:bg-green-50 text-green-700"
                              title="Approve"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={actionId === exp._id}
                              onClick={() => openEdit(exp)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                          </>
                        )}
                        {(exp.status === "pending" || exp.status === "approved") && (
                          <button
                            type="button"
                            disabled={actionId === exp._id}
                            onClick={() => runAction(exp._id, "mark-paid")}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-700"
                            title="Mark paid"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        {["pending", "approved"].includes(exp.status) && (
                          <button
                            type="button"
                            disabled={actionId === exp._id}
                            onClick={() => runAction(exp._id, "reject")}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                        {exp.status !== "paid" && exp.status !== "cancelled" && (
                          <button
                            type="button"
                            disabled={actionId === exp._id}
                            onClick={() => runAction(exp._id, "cancel")}
                            className="p-2 rounded-lg hover:bg-slate-100 text-xs"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        )}
                        {["pending", "rejected", "cancelled"].includes(exp.status) && (
                          <button
                            type="button"
                            disabled={actionId === exp._id}
                            onClick={() => deleteExpense(exp)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit expense" : "Add expense"}
            </h2>
            <form onSubmit={saveExpense} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as CategoryFilter })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={form.amount || ""}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Expense date *</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor / payee</label>
                  <input
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reference #</label>
                  <input
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              {!editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.recordAsPaid}
                    onChange={(e) => setForm({ ...form, recordAsPaid: e.target.checked })}
                  />
                  Record as already paid
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
