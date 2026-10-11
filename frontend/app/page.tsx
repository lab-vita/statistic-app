"use client";

import { useState } from "react";
import { AuthGate, useAuth } from "@/components/auth-gate";
import { Sidebar, type Section } from "@/components/sidebar";
import { CallsPage }        from "@/components/pages/calls-page";
import { AppointmentsPage } from "@/components/pages/appointments-page";
import { RevenuePage }      from "@/components/pages/revenue-page";
import { PlansPage }        from "@/components/pages/plans-page";
import { ReportsPage }      from "@/components/pages/reports-page";
import { AdminPage }        from "@/components/pages/admin-page";
import { HomePage }         from "@/components/pages/home-page";

function App() {
  const { canSee } = useAuth();
  const [section, setSection] = useState<Section>("home");

  function handleNav(s: Section) {
    if (canSee(s)) setSection(s);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar section={section} onSelectSection={handleNav} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {section === "home"         && <HomePage         onNavigate={handleNav} />}
        {section === "calls"        && <CallsPage />}
        {section === "appointments" && <AppointmentsPage />}
        {section === "revenue"      && <RevenuePage />}
        {section === "reports"      && <ReportsPage />}
        {section === "plans"        && <PlansPage />}
        {section === "admin"        && <AdminPage />}
      </div>
    </div>
  );
}

export default function Page() {
  return <AuthGate><App /></AuthGate>;
}
