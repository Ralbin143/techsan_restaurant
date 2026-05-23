"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Printer, QrCode, RefreshCw, Settings } from "lucide-react";

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
  diningAreaId?: DiningArea | string;
}

function orderUrl(qrToken: string | undefined) {
  if (!qrToken || typeof window === "undefined") return "";
  return `${window.location.origin}/order/${qrToken}`;
}

function areaLabel(table: TableRow, areas: DiningArea[]) {
  if (typeof table.diningAreaId === "object" && table.diningAreaId?.name) {
    return table.diningAreaId.name;
  }
  const id = typeof table.diningAreaId === "string" ? table.diningAreaId : "";
  return areas.find((a) => a._id === id)?.name || "—";
}

function QrPrintCard({
  branchName,
  table,
  areas,
}: {
  branchName: string;
  table: TableRow;
  areas: DiningArea[];
}) {
  const url = orderUrl(table.qrToken);
  const area = areaLabel(table, areas);

  return (
    <article
      className="break-inside-avoid relative overflow-hidden rounded-2xl border-2 border-stone-800/85 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-none print:overflow-visible print:border-stone-900 print:bg-white print:shadow-none"
    >
      <div
        className="h-1.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 print:h-2 print:from-orange-600 print:via-amber-500 print:to-orange-600"
        aria-hidden
      />

      <div className="relative px-5 pt-4 pb-3 print:px-6 print:pt-5 print:pb-4">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-500/[0.07] print:bg-orange-500/10"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-3 print:border-stone-300">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700 print:text-orange-800">
              Scan to order
            </p>
            <h3 className="mt-1 text-3xl font-black tracking-tight text-stone-900 tabular-nums dark:text-white print:text-black sm:text-4xl">
              Table {table.number}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 dark:text-slate-400 print:text-stone-600">
              Location
            </p>
            <p className="text-xs font-semibold text-stone-700 dark:text-slate-200 print:text-black">
              {area}
            </p>
            <p className="mt-0.5 max-w-[9rem] text-[10px] leading-snug text-stone-500 dark:text-slate-400 print:text-stone-600">
              {branchName}
            </p>
          </div>
        </div>

        <div className="relative mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center print:mt-5 print:grid-cols-[auto_1fr] print:gap-5">
          <div className="mx-auto flex w-fit flex-col items-center sm:mx-0">
            <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-white p-4 shadow-inner dark:border-slate-600 dark:bg-slate-950 print:border-stone-400 print:bg-white print:p-5">
              {table.qrCode ? (
                <img
                  src={table.qrCode}
                  alt=""
                  className="h-36 w-36 object-contain sm:h-40 sm:w-40 print:h-44 print:w-44"
                />
              ) : (
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-xl bg-stone-100 text-center text-xs font-medium text-stone-400 sm:h-40 sm:w-40 print:h-44 print:w-44 print:border print:border-dashed print:border-stone-400">
                  Generate QR
                  <span className="mt-1 text-[10px] font-normal">in Settings</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-wider text-stone-400 print:text-stone-500">
              Point camera here
            </p>
          </div>

          <div className="min-w-0 space-y-3 print:space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 dark:text-slate-400 print:text-stone-700">
                How it works
              </p>
              <ol className="mt-2 space-y-1.5 text-[11px] leading-snug text-stone-700 dark:text-slate-300 print:text-[11px] print:text-stone-800">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-800 print:bg-orange-100">
                    1
                  </span>
                  <span>Open your phone camera (no app needed).</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-800 print:bg-orange-100">
                    2
                  </span>
                  <span>Scan the code — the menu opens in your browser.</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-800 print:bg-orange-100">
                    3
                  </span>
                  <span>Add dishes, send your order, and track status live.</span>
                </li>
              </ol>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 dark:text-slate-400 print:text-stone-700">
                Direct link
              </p>
              <div className="mt-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/80 print:border-stone-300 print:bg-stone-50">
                <p className="font-mono text-[9px] leading-relaxed break-all text-stone-800 dark:text-slate-200 print:text-[8.5px] print:text-black">
                  {url || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-stone-50/90 px-5 py-2.5 text-[10px] text-stone-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 print:border-stone-300 print:bg-stone-100 print:text-stone-800 print:px-6">
        <span className="font-semibold uppercase tracking-wide text-stone-500 print:text-stone-700">
          {table.capacity} seats · {branchName}
        </span>
        <span className="text-stone-500 print:text-stone-600">Need help? Ask your server.</span>
      </footer>
    </article>
  );
}

export default function SettingsPage() {
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchName, setBranchName] = useState("");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, areasRes] = await Promise.all([
        api.get("/tables/live", { params: { branchId } }),
        api.get("/tables/areas", { params: { branchId } }),
      ]);
      const rawTables = tablesRes.data.data;
      const rawAreas = areasRes.data.data;
      setTables(Array.isArray(rawTables) ? rawTables : []);
      setAreas(Array.isArray(rawAreas) ? rawAreas : []);
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
        const list: Branch[] = res.data.data || [];
        setBranches(list);
        const saved = localStorage.getItem("branchId");
        const id = saved && list.some((b) => b._id === saved) ? saved : list[0]?._id || "";
        if (id) setBranchId(id);
      })
      .catch(() => setError("Failed to load branches"));
  }, []);

  useEffect(() => {
    const b = branches.find((x) => x._id === branchId);
    setBranchName(b?.name || "");
  }, [branchId, branches]);

  useEffect(() => {
    if (branchId) {
      localStorage.setItem("branchId", branchId);
      loadTables();
    }
  }, [branchId, loadTables]);

  const missingQr = useMemo(() => tables.filter((t) => !t.qrCode), [tables]);

  const printBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const btn = printBtnRef.current;
    if (!btn) return;
    const onPrint = () => {
      if (typeof window === "undefined") return;
      window.focus();
      window.print();
    };
    btn.addEventListener("click", onPrint, true);
    return () => btn.removeEventListener("click", onPrint, true);
  }, []);

  const ensureMissingQrs = async () => {
    if (missingQr.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const next: TableRow[] = [...tables];
      for (const t of missingQr) {
        const res = await api.post(`/tables/${t._id}/qr`);
        const updated = res.data.data as TableRow;
        const idx = next.findIndex((x) => x._id === t._id);
        if (idx >= 0) next[idx] = { ...next[idx], ...updated };
      }
      setTables(next);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to generate some QR codes";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="text-orange-600" size={28} />
            Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Branch tools and printable assets for your restaurant.
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
            onClick={loadTables}
            disabled={loading}
            className="p-2 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            title="Refresh tables"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm print:hidden">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm print:shadow-none print:border-0 print:bg-white print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6 print:mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white print:text-black">
              <QrCode className="text-orange-600 print:text-black" size={22} />
              Table QR codes (print)
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl print:text-slate-700">
              Print cards for each table so guests can scan and open the ordering page. Use{" "}
              <strong className="text-slate-700">Generate missing QR codes</strong> if a table has
              no image yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={ensureMissingQrs}
              disabled={generating || missingQr.length === 0}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {generating ? "Generating…" : `Generate missing (${missingQr.length})`}
            </button>
            <button
              ref={printBtnRef}
              type="button"
              disabled={tables.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Open print dialog"
            >
              <Printer size={16} />
              Print sheet
            </button>
          </div>
        </div>

        {missingQr.length > 0 && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 print:hidden">
            {missingQr.length} table{missingQr.length > 1 ? "s" : ""} still need a QR image.
            Generate them before printing for best results.
          </p>
        )}

        {loading ? (
          <p className="text-slate-500 py-8 text-center print:hidden">Loading tables…</p>
        ) : tables.length === 0 ? (
          <p className="text-slate-400 py-8 text-center print:hidden">No tables in this branch.</p>
        ) : (
          <>
            <div className="mb-4 hidden items-center justify-between border-b border-stone-300 pb-3 print:flex">
              <p className="text-sm font-bold text-stone-900">Table QR sheet</p>
              <p className="text-xs text-stone-600">
                {branchName} · {tables.length} table{tables.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-2 print:grid-cols-2 print:gap-8">
              {tables.map((table) => (
                <QrPrintCard key={table._id} branchName={branchName} table={table} areas={areas} />
              ))}
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-slate-400 print:hidden">
          Tip: in the print dialog, disable headers/footers for a cleaner sheet. Card stock works well
          for table tents. If Print sheet does nothing (some embedded browsers), use{" "}
          <kbd className="rounded border border-slate-300 px-1 py-0.5 font-mono text-[10px]">
            ⌘P
          </kbd>{" "}
          /{" "}
          <kbd className="rounded border border-slate-300 px-1 py-0.5 font-mono text-[10px]">
            Ctrl+P
          </kbd>
          .
        </p>
      </section>
    </div>
  );
}
