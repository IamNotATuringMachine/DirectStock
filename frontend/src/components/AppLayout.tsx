import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import OfflineSyncPanel from "./offline/OfflineSyncPanel";
import PwaStatus from "./pwa/PwaStatus";
import { fetchMyUiPreferences, updateMyUiPreferences } from "../services/uiPreferencesApi";
import { useAuthStore } from "../stores/authStore";
import { useUiPreferencesStore } from "../stores/uiPreferencesStore";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  requiredPermissions?: string[];
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "DB", requiredPermissions: ["page.dashboard.view"] },
  { to: "/products", label: "Artikelstamm", shortLabel: "AR", requiredPermissions: ["page.products.view"] },
  { to: "/warehouse", label: "Lagerstruktur", shortLabel: "LG", requiredPermissions: ["page.warehouse.view"] },
  { to: "/inventory", label: "Bestandsübersicht", shortLabel: "BS", requiredPermissions: ["page.inventory.view"] },
  { to: "/inventory-counts", label: "Inventur", shortLabel: "IV", requiredPermissions: ["page.inventory-counts.view"] },
  { to: "/purchasing", label: "Einkauf", shortLabel: "EK", requiredPermissions: ["page.purchasing.view"] },
  { to: "/picking", label: "Kommissionierung", shortLabel: "PK", requiredPermissions: ["page.picking.view"] },
  { to: "/returns", label: "Retouren", shortLabel: "RT", requiredPermissions: ["page.returns.view"] },
  { to: "/approvals", label: "Genehmigungen", shortLabel: "GN", requiredPermissions: ["page.approvals.view"] },
  { to: "/documents", label: "Dokumente", shortLabel: "DM", requiredPermissions: ["page.documents.view"] },
  { to: "/audit-trail", label: "Audit-Trail", shortLabel: "AT", requiredPermissions: ["page.audit-trail.view"] },
  { to: "/reports", label: "Berichte", shortLabel: "RP", requiredPermissions: ["page.reports.view"] },
  { to: "/alerts", label: "Warnungen", shortLabel: "AL", requiredPermissions: ["page.alerts.view"] },
  { to: "/goods-receipt", label: "Wareneingang", shortLabel: "WE", requiredPermissions: ["page.goods-receipt.view"] },
  { to: "/goods-issue", label: "Warenausgang", shortLabel: "WA", requiredPermissions: ["page.goods-issue.view"] },
  { to: "/stock-transfer", label: "Umlagerung", shortLabel: "UM", requiredPermissions: ["page.stock-transfer.view"] },
  {
    to: "/inter-warehouse-transfer",
    label: "Zwischenlager",
    shortLabel: "IW",
    requiredPermissions: ["page.inter-warehouse-transfer.view"],
  },
  { to: "/shipping", label: "Versand", shortLabel: "SH", requiredPermissions: ["page.shipping.view"] },
  { to: "/scanner", label: "Scanner", shortLabel: "SC", requiredPermissions: ["page.scanner.view"] },
  { to: "/services", label: "Dienstleistungen", shortLabel: "SV", requiredPermissions: ["page.services.view"] },
  { to: "/sales-orders", label: "Verkaufsaufträge", shortLabel: "SO", requiredPermissions: ["page.sales-orders.view"] },
  { to: "/invoices", label: "Rechnungen", shortLabel: "RE", requiredPermissions: ["page.invoices.view"] },
  { to: "/users", label: "Benutzerverwaltung", shortLabel: "BU", requiredPermissions: ["page.users.view"] },
];

const IDLE_LOGOUT_MS = 30 * 60 * 1000;

function canAccess(requiredPermissions: string[] | undefined, granted: Set<string>) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }
  return requiredPermissions.some((permission) => granted.has(permission));
}

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  const theme = useUiPreferencesStore((state) => state.theme);
  const compactMode = useUiPreferencesStore((state) => state.compact_mode);
  const showHelp = useUiPreferencesStore((state) => state.show_help);
  const setPreferences = useUiPreferencesStore((state) => state.setPreferences);
  const setTheme = useUiPreferencesStore((state) => state.setTheme);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1100px)").matches : false
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const grantedPermissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  useEffect(() => {
    void fetchMyUiPreferences()
      .then((payload) => setPreferences(payload))
      .catch(() => undefined);
  }, [setPreferences]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    setIsMobileLayout(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsMobileNavOpen(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (isMobileLayout) {
      setIsMobileNavOpen(false);
    }
  }, [isMobileLayout, location.pathname]);

  useEffect(() => {
    if (!(isMobileLayout && isMobileNavOpen)) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileLayout, isMobileNavOpen]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let timeoutId: number | null = null;
    const resetIdleTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        void logout();
      }, IDLE_LOGOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetIdleTimer as EventListenerOrEventListenerObject)
      );
    };
  }, [accessToken, logout]);

  const onToggleNavigation = () => {
    if (isMobileLayout) {
      setIsMobileNavOpen((value) => !value);
      return;
    }

    setIsSidebarCollapsed((value) => !value);
  };

  const onToggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      await updateMyUiPreferences({
        theme: nextTheme,
        compact_mode: compactMode,
        show_help: showHelp,
      });
    } catch {
      // local preference remains as fallback when backend call fails.
    }
  };

  const shellClassName = [
    "shell",
    !isMobileLayout && isSidebarCollapsed ? "sidebar-collapsed" : "",
    isMobileLayout ? "mobile-layout" : "",
    isMobileLayout && isMobileNavOpen ? "mobile-nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName} data-testid="app-shell">
      {isMobileLayout ? (
        <button
          className="sidebar-overlay"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label="Navigation schließen"
          type="button"
        />
      ) : null}
      <aside className="sidebar">
        <div className="brand">DirectStock</div>
        <nav>
          {navItems
            .filter((item) => canAccess(item.requiredPermissions, grantedPermissions))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  if (isMobileLayout) {
                    setIsMobileNavOpen(false);
                  }
                }}
              >
                <span className="nav-link-short">{item.shortLabel}</span>
                <span className="nav-link-label">{item.label}</span>
              </NavLink>
            ))}
        </nav>
        {isMobileLayout ? (
          <div className="sidebar-utilities" data-testid="sidebar-utilities">
            <button
              className="btn"
              type="button"
              onClick={() => void onToggleTheme()}
              data-testid="theme-toggle-btn"
            >
              Design: {theme}
            </button>
            <OfflineSyncPanel />
          </div>
        ) : null}
      </aside>
      <div className="content-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="btn sidebar-toggle"
              onClick={onToggleNavigation}
              data-testid="sidebar-toggle"
              aria-label={
                isMobileLayout
                  ? isMobileNavOpen
                    ? "Navigation schließen"
                    : "Navigation öffnen"
                  : isSidebarCollapsed
                    ? "Sidebar erweitern"
                    : "Sidebar einklappen"
              }
            >
              {isMobileLayout ? (isMobileNavOpen ? "×" : "☰") : isSidebarCollapsed ? "»" : "«"}
            </button>
            <div className="topbar-user">
              <strong className="topbar-user-name">{user?.username ?? "-"}</strong>
            </div>
          </div>
          <div className="topbar-right" data-testid="topbar-right">
            {!isMobileLayout ? (
              <button className="btn" type="button" onClick={() => void onToggleTheme()} data-testid="theme-toggle-btn">
                Design: {theme}
              </button>
            ) : null}
            <PwaStatus compact={isMobileLayout} />
            {!isMobileLayout ? <OfflineSyncPanel /> : null}
            <button className="btn" onClick={() => void logout()} data-testid="logout-btn">
              Abmelden
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
