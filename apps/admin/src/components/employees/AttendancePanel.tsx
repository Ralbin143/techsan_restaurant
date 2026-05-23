"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart3,
  ClipboardList,
  Download,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
} from "lucide-react";

interface UserRef {
  firstName: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface Employee {
  _id: string;
  employeeCode: string;
  department?: string;
  userId: UserRef;
}

interface AttendanceRecord {
  _id: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  notes?: string;
}

interface RosterRow {
  employee: Employee;
  attendance: AttendanceRecord | null;
}

interface ReportRow {
  employee: Employee;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysLate: number;
  daysHalfDay: number;
  unmarkedDays: number;
  totalHours: number;
}

interface AttendanceReport {
  from: string;
  to: string;
  totalDays: number;
  totals: {
    daysPresent: number;
    daysAbsent: number;
    daysLeave: number;
    totalHours: number;
  };
  rows: ReportRow[];
}

type AttendanceView = "entry" | "report";

const STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "half_day", label: "Half day" },
  { value: "leave", label: "On leave" },
];

function fullName(user?: UserRef) {
  if (!user) return "—";
  return `${user.firstName} ${user.lastName || ""}`.trim();
}

function toTimeInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface RowDraft {
  status: string;
  checkIn: string;
  checkOut: string;
  notes: string;
}

function draftFromRow(row: RosterRow): RowDraft {
  const att = row.attendance;
  return {
    status: att?.status || "present",
    checkIn: toTimeInput(att?.checkIn) || "09:00",
    checkOut: toTimeInput(att?.checkOut) || "18:00",
    notes: att?.notes || "",
  };
}

interface AttendancePanelProps {
  branchId: string;
}

export function AttendancePanel({ branchId }: AttendancePanelProps) {
  const [view, setView] = useState<AttendanceView>("entry");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/employees/attendance/roster", {
        params: { branchId, date: entryDate },
      });
      const rows: RosterRow[] = res.data.data || [];
      setRoster(rows);
      const next: Record<string, RowDraft> = {};
      rows.forEach((row) => {
        next[row.employee._id] = draftFromRow(row);
      });
      setDrafts(next);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load roster";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, entryDate]);

  const loadReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/employees/attendance/report", {
        params: { branchId, from: reportFrom, to: reportTo },
      });
      setReport(res.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load report";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [branchId, reportFrom, reportTo]);

  useEffect(() => {
    if (branchId && view === "entry") loadRoster();
  }, [branchId, view, loadRoster]);

  useEffect(() => {
    if (branchId && view === "report") loadReport();
  }, [branchId, view, loadReport]);

  const updateDraft = (employeeId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], ...patch },
    }));
  };

  const saveRow = async (employeeId: string) => {
    const draft = drafts[employeeId];
    if (!draft) return;

    setSavingId(employeeId);
    try {
      const isAbsent = draft.status === "absent" || draft.status === "leave";
      await api.post("/employees/attendance/upsert", {
        branchId,
        employeeId,
        date: entryDate,
        status: draft.status,
        checkIn: isAbsent ? "" : draft.checkIn,
        checkOut: isAbsent ? "" : draft.checkOut,
        notes: draft.notes,
      });
      await loadRoster();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save";
      alert(message);
    } finally {
      setSavingId(null);
    }
  };

  const saveAllPresent = async () => {
    if (!window.confirm(`Mark all staff present for ${entryDate}?`)) return;
    setSavingId("all");
    try {
      for (const row of roster) {
        const draft = drafts[row.employee._id] || draftFromRow(row);
        await api.post("/employees/attendance/upsert", {
          branchId,
          employeeId: row.employee._id,
          date: entryDate,
          status: "present",
          checkIn: draft.checkIn || "09:00",
          checkOut: draft.checkOut || "18:00",
          notes: draft.notes,
        });
      }
      await loadRoster();
    } catch {
      alert("Failed to save all");
    } finally {
      setSavingId(null);
    }
  };

  const quickCheckIn = async (employeeId: string) => {
    setSavingId(`in-${employeeId}`);
    try {
      await api.post("/employees/attendance/check-in", {
        employeeId,
        branchId,
        date: entryDate,
      });
      await loadRoster();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Check-in failed";
      alert(message);
    } finally {
      setSavingId(null);
    }
  };

  const quickCheckOut = async (employeeId: string) => {
    setSavingId(`out-${employeeId}`);
    try {
      await api.post("/employees/attendance/check-out", {
        employeeId,
        date: entryDate,
      });
      await loadRoster();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Check-out failed";
      alert(message);
    } finally {
      setSavingId(null);
    }
  };

  const exportReportCsv = () => {
    if (!report) return;
    const lines = [
      [
        "Employee Code",
        "Name",
        "Department",
        "Present",
        "Absent",
        "Leave",
        "Late",
        "Half Day",
        "Unmarked",
        "Total Hours",
      ].join(","),
      ...report.rows.map((r) =>
        [
          r.employee.employeeCode,
          `"${fullName(r.employee.userId)}"`,
          r.employee.department || "",
          r.daysPresent,
          r.daysAbsent,
          r.daysLeave,
          r.daysLate,
          r.daysHalfDay,
          r.unmarkedDays,
          r.totalHours,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${reportFrom}-${reportTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markedCount = roster.filter((r) => r.attendance).length;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setView("entry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            view === "entry" ? "bg-orange-600 text-white" : "border dark:border-slate-700"
          }`}
        >
          <ClipboardList size={16} />
          Daily entry
        </button>
        <button
          type="button"
          onClick={() => setView("report")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            view === "report" ? "bg-orange-600 text-white" : "border dark:border-slate-700"
          }`}
        >
          <BarChart3 size={16} />
          Report
        </button>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {view === "entry" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={loadRoster}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={saveAllPresent}
              disabled={savingId === "all" || roster.length === 0}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Mark all present
            </button>
            <span className="text-sm text-slate-500">
              {markedCount} / {roster.length} marked
            </span>
          </div>

          {loading ? (
            <p className="text-slate-500 text-center py-12">Loading roster...</p>
          ) : roster.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No active employees in this branch</p>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50 dark:border-slate-800">
                      <th className="text-left p-3 font-medium">Employee</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Check in</th>
                      <th className="text-left p-3 font-medium">Check out</th>
                      <th className="text-left p-3 font-medium">Notes</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((row) => {
                      const draft = drafts[row.employee._id] || draftFromRow(row);
                      const isAbsent =
                        draft.status === "absent" || draft.status === "leave";
                      const hasRecord = !!row.attendance;
                      return (
                        <tr
                          key={row.employee._id}
                          className={`border-b dark:border-slate-800 last:border-0 ${
                            hasRecord ? "bg-green-50/30 dark:bg-green-950/10" : ""
                          }`}
                        >
                          <td className="p-3">
                            <p className="font-medium">{fullName(row.employee.userId)}</p>
                            <p className="text-xs text-slate-500">
                              {row.employee.employeeCode}
                              {row.attendance?.hoursWorked != null &&
                                ` · ${row.attendance.hoursWorked}h`}
                            </p>
                          </td>
                          <td className="p-3">
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                updateDraft(row.employee._id, { status: e.target.value })
                              }
                              className="px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                            >
                              {STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="time"
                              value={isAbsent ? "" : draft.checkIn}
                              disabled={isAbsent}
                              onChange={(e) =>
                                updateDraft(row.employee._id, { checkIn: e.target.value })
                              }
                              className="px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="time"
                              value={isAbsent ? "" : draft.checkOut}
                              disabled={isAbsent}
                              onChange={(e) =>
                                updateDraft(row.employee._id, { checkOut: e.target.value })
                              }
                              className="px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={(e) =>
                                updateDraft(row.employee._id, { notes: e.target.value })
                              }
                              placeholder="Optional"
                              className="w-full min-w-[100px] px-2 py-1.5 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="Quick check in now"
                                disabled={!!savingId}
                                onClick={() => quickCheckIn(row.employee._id)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <LogIn size={16} />
                              </button>
                              <button
                                type="button"
                                title="Quick check out now"
                                disabled={!!savingId}
                                onClick={() => quickCheckOut(row.employee._id)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <LogOut size={16} />
                              </button>
                              <button
                                type="button"
                                disabled={savingId === row.employee._id}
                                onClick={() => saveRow(row.employee._id)}
                                className="flex items-center gap-1 px-2 py-1.5 bg-orange-600 text-white rounded-lg text-xs disabled:opacity-50"
                              >
                                <Save size={14} />
                                {savingId === row.employee._id ? "..." : "Save"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? "Loading..." : "Generate report"}
            </button>
            {report && (
              <button
                type="button"
                onClick={exportReportCsv}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>

          {loading && !report ? (
            <p className="text-slate-500 text-center py-12">Loading report...</p>
          ) : !report ? (
            <p className="text-slate-400 text-center py-12">Select a date range and generate report</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                  <p className="text-xs text-slate-500 uppercase">Period</p>
                  <p className="text-lg font-bold mt-1">{report.totalDays} days</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                  <p className="text-xs text-slate-500 uppercase">Present (total)</p>
                  <p className="text-lg font-bold mt-1 text-green-600">{report.totals.daysPresent}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                  <p className="text-xs text-slate-500 uppercase">Absent (total)</p>
                  <p className="text-lg font-bold mt-1 text-red-600">{report.totals.daysAbsent}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                  <p className="text-xs text-slate-500 uppercase">On leave (total)</p>
                  <p className="text-lg font-bold mt-1 text-amber-600">{report.totals.daysLeave}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                  <p className="text-xs text-slate-500 uppercase">Hours worked</p>
                  <p className="text-lg font-bold mt-1">{report.totals.totalHours.toFixed(1)}h</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-800/50 dark:border-slate-800">
                        <th className="text-left p-3 font-medium">Employee</th>
                        <th className="text-right p-3 font-medium">Present</th>
                        <th className="text-right p-3 font-medium">Absent</th>
                        <th className="text-right p-3 font-medium">Leave</th>
                        <th className="text-right p-3 font-medium">Late</th>
                        <th className="text-right p-3 font-medium">Half day</th>
                        <th className="text-right p-3 font-medium">Unmarked</th>
                        <th className="text-right p-3 font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr
                          key={row.employee._id}
                          className="border-b dark:border-slate-800 last:border-0"
                        >
                          <td className="p-3">
                            <p className="font-medium">{fullName(row.employee.userId)}</p>
                            <p className="text-xs text-slate-500">
                              {row.employee.employeeCode} · {row.employee.department || "—"}
                            </p>
                          </td>
                          <td className="p-3 text-right text-green-700">{row.daysPresent}</td>
                          <td className="p-3 text-right text-red-700">{row.daysAbsent}</td>
                          <td className="p-3 text-right text-amber-700">{row.daysLeave}</td>
                          <td className="p-3 text-right">{row.daysLate}</td>
                          <td className="p-3 text-right">{row.daysHalfDay}</td>
                          <td className="p-3 text-right text-slate-500">{row.unmarkedDays}</td>
                          <td className="p-3 text-right font-medium">{row.totalHours.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
