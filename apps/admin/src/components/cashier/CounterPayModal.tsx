"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Banknote, CreditCard, Smartphone, X } from "lucide-react";

export type CounterPayMethod = "cash" | "card" | "upi";

export interface CounterPayOrder {
  _id: string;
  orderNumber: string;
  total: number;
  tableId?: { number?: string } | null;
}

const PAY_METHODS: {
  id: CounterPayMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
];

interface CounterPayModalProps {
  order: CounterPayOrder;
  processing: boolean;
  onClose: () => void;
  onConfirm: (method: CounterPayMethod, tip: number) => void;
}

export function CounterPayModal({
  order,
  processing,
  onClose,
  onConfirm,
}: CounterPayModalProps) {
  const [method, setMethod] = useState<CounterPayMethod>("cash");
  const [tip, setTip] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-pay-title"
        className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 id="counter-pay-title" className="text-lg font-bold">
              Counter payment
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {order.orderNumber} · Table {order.tableId?.number || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-3xl font-bold text-orange-600 mb-4">{formatCurrency(order.total)}</p>

        <p className="text-sm font-medium mb-2">Payment method</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PAY_METHODS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              disabled={processing}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${
                method === id
                  ? "border-orange-600 bg-orange-50 text-orange-700 dark:bg-orange-950"
                  : "border-slate-200 dark:border-slate-700 hover:border-orange-300"
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tip (optional)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={tip || ""}
            onChange={(e) => setTip(Number(e.target.value) || 0)}
            placeholder="0"
            disabled={processing}
            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
          />
        </div>

        {tip > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Total collected: {formatCurrency(order.total + tip)}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex-1 py-3 border rounded-xl font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(method, tip)}
            disabled={processing}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            {processing ? "Processing..." : "Confirm payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
