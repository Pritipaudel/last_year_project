import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-surface-base">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-64">
        <main className="flex-1 pb-16 md:pb-0 relative min-h-screen">
          <div className="mx-auto w-full max-w-5xl h-full">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
