"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthGate, useAuth } from "@/components/auth-gate";
import { Sidebar } from "@/components/sidebar";
import { MobileNavContext } from "@/components/mobile-nav";
import { useBitrixFrameFit } from "@/lib/bitrix-frame";
import type { Section } from "@/lib/permissions";
import { CallsPage }        from "@/components/pages/calls-page";
import { AppointmentsPage } from "@/components/pages/appointments-page";
import { RevenuePage }      from "@/components/pages/revenue-page";
import { PlansPage }        from "@/components/pages/plans-page";
import { ReportsPage }      from "@/components/pages/reports-page";
import { AdminPage }        from "@/components/pages/admin-page";
import { HomePage }         from "@/components/pages/home-page";
import { AboutPage }        from "@/components/pages/about-page";
import { FunnelPage }       from "@/components/pages/funnel-page";
import { DoctorsPage }      from "@/components/pages/doctors-page";

function App() {
  const { canSee } = useAuth();
  const [section, setSection] = useState<Section>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const nav = useMemo(() => ({ open: () => setMenuOpen(true) }), []);

  // Внутри Битрикс24 — подогнать высоту окна под видимую часть экрана
  useBitrixFrameFit();

  function handleNav(s: Section) {
    if (s === "about" || canSee(s)) setSection(s);
  }

  return (
    <MobileNavContext.Provider value={nav}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar section={section} onSelectSection={handleNav} mobileOpen={menuOpen} onMobileClose={closeMenu} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {section === "home"         && <HomePage />}
          {section === "calls"        && <CallsPage />}
          {section === "appointments" && <AppointmentsPage />}
          {section === "revenue"      && <RevenuePage />}
          {section === "reports"      && <ReportsPage />}
          {section === "funnel"       && <FunnelPage />}
          {section === "plans"        && <PlansPage />}
          {section === "doctors"      && <DoctorsPage />}
          {section === "admin"        && <AdminPage />}
          {section === "about"        && <AboutPage />}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

export default function Page() {
  return <AuthGate><App /></AuthGate>;
}
