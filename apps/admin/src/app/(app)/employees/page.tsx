"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { AttendancePanel } from "@/components/employees/AttendancePanel";
import {
  Calendar,
  CheckCircle,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

interface Branch {
  _id: string;
  name: string;
}

interface UserRef {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isActive?: boolean;
}

interface Employee {
  _id: string;
  employeeCode: string;
  designation?: string;
  department?: string;
  joinDate?: string;
  salary?: { base: number; type: string };
  emergencyContact?: { name?: string; phone?: string };
  isActive: boolean;
  userId: UserRef;
}

interface LeaveRow {
  _id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  employeeId: Employee;
}

type PageTab = "employees" | "attendance" | "leave";

const ROLE_OPTIONS = [
  { value: "waiter", label: "Waiter" },
  { value: "kitchen_staff", label: "Kitchen" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "restaurant_admin", label: "Restaurant admin" },
];

const ROLE_LABELS: Record<string, string> = {
  waiter: "Waiter",
  kitchen_staff: "Kitchen",
  cashier: "Cashier",
  manager: "Manager",
  restaurant_admin: "Admin",
};

const DEPARTMENTS = ["Front of House", "Kitchen", "Management", "Finance"];

const LEAVE_TYPES = [
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

const emptyForm = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "waiter",
  employeeCode: "",
  designation: "",
  department: "",
  joinDate: "",
  salaryBase: 0,
  salaryType: "monthly" as "monthly" | "hourly",
  emergencyName: "",
  emergencyPhone: "",
};

function fullName(user?: UserRef) {
  if (!user) return "—";
  return `${user.firstName} ${user.lastName || ""}`.trim();
}

export default function EmployeesPage() {
  const [pageTab, setPageTab] = useState<PageTab>("employees");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [leaveFilter, setLeaveFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    type: "casual",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!branchId) return;
    const params: Record<string, string> = { branchId };
    if (activeFilter === "active") params.active = "true";
    if (activeFilter === "inactive") params.active = "false";
    const res = await api.get("/employees", { params });
    setEmployees(res.data.data || []);
  }, [branchId, activeFilter]);

  const loadLeaves = useCallback(async () => {
    if (!branchId) return;
    const params: Record<string, string> = { branchId };
    if (leaveFilter === "pending") params.status = "pending";
    const res = await api.get("/employees/leave/list", { params });
    setLeaves(res.data.data || []);
  }, [branchId, leaveFilter]);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadEmployees(), loadLeaves()]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load employee data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, loadEmployees, loadLeaves]);

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

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const u = e.userId;
      return (
        e.employeeCode.toLowerCase().includes(q) ||
        fullName(u).toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
      );
    });
  }, [employees, search]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.isActive).length;
    const pendingLeave = leaves.filter((l) => l.status === "pending").length;
    return { active, pendingLeave };
  }, [employees, leaves]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    const u = emp.userId;
    setEditingId(emp._id);
    setForm({
      email: u.email,
      password: "",
      firstName: u.firstName,
      lastName: u.lastName || "",
      phone: u.phone || "",
      role: u.role,
      employeeCode: emp.employeeCode,
      designation: emp.designation || "",
      department: emp.department || "",
      joinDate: emp.joinDate ? emp.joinDate.slice(0, 10) : "",
      salaryBase: emp.salary?.base ?? 0,
      salaryType: (emp.salary?.type as "monthly" | "hourly") || "monthly",
      emergencyName: emp.emergencyContact?.name || "",
      emergencyPhone: emp.emergencyContact?.phone || "",
    });
    setModalOpen(true);
  };

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    setSaving(true);
    try {
      const payload = {
        branchId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        role: form.role,
        designation: form.designation.trim(),
        department: form.department,
        joinDate: form.joinDate || undefined,
        salary: { base: Number(form.salaryBase), type: form.salaryType },
        emergencyContact: {
          name: form.emergencyName.trim(),
          phone: form.emergencyPhone.trim(),
        },
      };

      if (editingId) {
        const update: Record<string, unknown> = { ...payload };
        if (form.password) update.password = form.password;
        await api.patch(`/employees/${editingId}`, update);
      } else {
        await api.post("/employees", {
          ...payload,
          email: form.email.trim(),
          password: form.password,
          employeeCode: form.employeeCode.trim() || undefined,
        });
      }
      setModalOpen(false);
      await loadEmployees();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save employee";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const deactivateEmployee = async (emp: Employee) => {
    if (!window.confirm(`Deactivate ${fullName(emp.userId)}? They will lose system access.`)) return;
    try {
      await api.delete(`/employees/${emp._id}`);
      await loadEmployees();
    } catch {
      alert("Failed to deactivate employee");
    }
  };

  const toggleActive = async (emp: Employee) => {
    setActionId(emp._id);
    try {
      await api.patch(`/employees/${emp._id}`, { isActive: !emp.isActive });
      await loadEmployees();
    } catch {
      alert("Failed to update status");
    } finally {
      setActionId(null);
    }
  };

  const saveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/employees/leave", leaveForm);
      setLeaveModalOpen(false);
      await loadLeaves();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create leave request";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const updateLeave = async (id: string, status: "approved" | "rejected") => {
    setActionId(id);
    try {
      await api.patch(`/employees/leave/${id}/status`, { status });
      await loadLeaves();
    } catch {
      alert("Failed to update leave");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-orange-600" size={28} />
            Employee management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Staff profiles, attendance, and leave requests
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
          {pageTab === "employees" && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              <Plus size={16} />
              Add employee
            </button>
          )}
          {pageTab === "leave" && (
            <button
              type="button"
              onClick={() => {
                setLeaveForm({
                  employeeId: employees[0]?._id || "",
                  type: "casual",
                  startDate: "",
                  endDate: "",
                  reason: "",
                });
                setLeaveModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              <Plus size={16} />
              Request leave
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Active staff</p>
          <p className="text-2xl font-bold mt-1">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 uppercase">Pending leave</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pendingLeave}</p>
        </div>
      </div>
      <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden mb-6 w-fit">
        {(
          [
            ["employees", "Employees", Users],
            ["attendance", "Attendance", Clock],
            ["leave", "Leave", Calendar],
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

      {pageTab === "employees" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, email..."
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden">
              {(["active", "all", "inactive"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-2 text-sm capitalize ${
                    activeFilter === f ? "bg-orange-600 text-white" : "bg-white dark:bg-slate-900"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-slate-500 text-center py-12">Loading...</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No employees found</p>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left p-3 font-medium">Employee</th>
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Department</th>
                      <th className="text-right p-3 font-medium">Salary</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp._id}
                        className="border-b dark:border-slate-800 last:border-0"
                      >
                        <td className="p-3">
                          <p className="font-medium">{fullName(emp.userId)}</p>
                          <p className="text-xs text-slate-500">{emp.userId.email}</p>
                        </td>
                        <td className="p-3 font-mono text-xs">{emp.employeeCode}</td>
                        <td className="p-3">{ROLE_LABELS[emp.userId.role] || emp.userId.role}</td>
                        <td className="p-3 text-slate-500">{emp.department || "—"}</td>
                        <td className="p-3 text-right">
                          {emp.salary
                            ? `${formatCurrency(emp.salary.base)}/${emp.salary.type === "hourly" ? "hr" : "mo"}`
                            : "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              emp.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {emp.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(emp)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={actionId === emp._id}
                              onClick={() => toggleActive(emp)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
                              title={emp.isActive ? "Deactivate" : "Activate"}
                            >
                              {emp.isActive ? "Off" : "On"}
                            </button>
                            {emp.isActive && (
                              <button
                                type="button"
                                onClick={() => deactivateEmployee(emp)}
                                className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                title="Remove"
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
        </>
      )}

      {pageTab === "attendance" && branchId && <AttendancePanel branchId={branchId} />}

      {pageTab === "leave" && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setLeaveFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                leaveFilter === "pending" ? "bg-orange-600 text-white" : "border"
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setLeaveFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                leaveFilter === "all" ? "bg-orange-600 text-white" : "border"
              }`}
            >
              All
            </button>
          </div>

          {loading ? (
            <p className="text-slate-500 text-center py-12">Loading...</p>
          ) : leaves.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No leave requests</p>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave) => {
                const emp = leave.employeeId as Employee;
                return (
                  <div
                    key={leave._id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium">{fullName(emp?.userId)}</p>
                        <p className="text-sm text-slate-500 capitalize">
                          {leave.type} leave ·{" "}
                          {new Date(leave.startDate).toLocaleDateString()} –{" "}
                          {new Date(leave.endDate).toLocaleDateString()}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-slate-600 mt-1">{leave.reason}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full h-fit capitalize ${
                          leave.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : leave.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    {leave.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          disabled={actionId === leave._id}
                          onClick={() => updateLeave(leave._id, "approved")}
                          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionId === leave._id}
                          onClick={() => updateLeave(leave._id, "rejected")}
                          className="text-sm px-3 py-1.5 border border-red-200 text-red-700 rounded-lg flex items-center gap-1"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit employee" : "Add employee"}
            </h2>
            <form onSubmit={saveEmployee} className="space-y-3">
              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                      required={!editingId}
                      minLength={6}
                    />
                  </div>
                </>
              )}
              {editingId && (
                <div>
                  <label className="block text-sm font-medium mb-1">New password (optional)</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    minLength={6}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First name *</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Employee code</label>
                  <input
                    value={form.employeeCode}
                    onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                    placeholder="Auto-generated if empty"
                    disabled={!!editingId}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Join date</label>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="">Select</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Salary (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.salaryBase}
                    onChange={(e) =>
                      setForm({ ...form, salaryBase: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pay type</label>
                  <select
                    value={form.salaryType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        salaryType: e.target.value as "monthly" | "hourly",
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
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
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {leaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">Leave request</h2>
            <form onSubmit={saveLeave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Employee *</label>
                <select
                  value={leaveForm.employeeId}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                >
                  <option value="">Select</option>
                  {employees
                    .filter((e) => e.isActive)
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {fullName(e.userId)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start *</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End *</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
