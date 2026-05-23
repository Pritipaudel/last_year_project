import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";

export function OnboardingLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-base">
      <Header title="Setup Profile" />
      <main className="flex-1 relative flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl h-full flex flex-col pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
