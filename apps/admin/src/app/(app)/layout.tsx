"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CustomerAlertsProvider } from "@/contexts/CustomerAlertsContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CustomerAlertsProvider>
        <div className="flex min-h-screen print:block">
          <Sidebar />
          <main className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-auto print:w-full print:max-w-none print:overflow-visible print:bg-white print:p-4">
            {children}
          </main>
        </div>
      </CustomerAlertsProvider>
    </AuthGuard>
  );
}
