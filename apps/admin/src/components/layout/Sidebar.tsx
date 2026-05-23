"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Banknote,
  Truck,
  Receipt,
} from "lucide-react";
import { logout } from "@/store/slices/authSlice";
import { toggleTheme } from "@/store/slices/themeSlice";
import type { RootState, AppDispatch } from "@/store";
import { cn } from "@/lib/utils";
import { useCustomerAlerts } from "@/contexts/CustomerAlertsContext";

const allNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cashier", label: "Cashier", icon: Banknote },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/tables", label: "Tables", icon: Grid3X3 },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const cashierNavItems = [
  { href: "/cashier", label: "Cashier", icon: Banknote },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
];

function navItemsForRole(role?: string) {
  return role === "cashier" ? cashierNavItems : allNavItems;
}

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const { mode } = useSelector((s: RootState) => s.theme);
  const { requestCount, connected } = useCustomerAlerts();
  const navItems = navItemsForRole(user?.role);

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 min-h-screen flex flex-col print:hidden">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-orange-400">TechSan</h1>
        <p className="text-xs text-slate-400 mt-1 truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition relative",
              pathname === href
                ? "bg-orange-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
            )}
          >
            <Icon size={18} />
            {label}
            {href === "/orders" && requestCount > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white">
                {requestCount}
              </span>
            )}
            {href === "/orders" && connected && requestCount === 0 && (
              <span
                className="ml-auto w-2 h-2 rounded-full bg-green-400"
                title="Live updates on"
              />
            )}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 space-y-2">
        <button
          onClick={() => dispatch(toggleTheme())}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg"
        >
          {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {mode === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={() => dispatch(logout())}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
