import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import OfflineSyncPanel from "./offline/OfflineSyncPanel";
import PwaStatus from "./pwa/PwaStatus";
import { useAuthStore } from "../stores/authStore";
import type { RoleName } from "../types";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  roles?: RoleName[];
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "DB" },
  { to: "/products", label: "Artikelstamm", shortLabel: "AR" },
  { to: "/warehouse", label: "Lagerstruktur", shortLabel: "LG" },
  { to: "/inventory", label: "Bestandsübersicht", shortLabel: "BS" },
  {
    to: "/inventory-counts",
    label: "Inventur",
    shortLabel: "IV",
    roles: ["admin", "lagerleiter", "lagermitarbeiter"],
  },
  {
    to: "/purchasing",
    label: "Einkauf",
    shortLabel: "EK",
    roles: ["admin", "lagerleiter", "einkauf"],
  },
  {
    to: "/picking",
    label: "Picking",
    shortLabel: "PK",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "versand"],
  },
  {
    to: "/returns",
    label: "Retouren",
    shortLabel: "RT",
    roles: ["admin", "lagerleiter", "versand"],
  },
  {
    to: "/approvals",
    label: "Genehmigungen",
    shortLabel: "GN",
    roles: ["admin", "lagerleiter", "einkauf", "versand"],
  },
  {
    to: "/documents",
    label: "Dokumente",
    shortLabel: "DM",
    roles: ["admin", "lagerleiter", "einkauf", "versand", "controller", "auditor"],
  },
  {
    to: "/audit-trail",
    label: "Audit Trail",
    shortLabel: "AT",
    roles: ["admin", "lagerleiter", "controller", "auditor"],
  },
  {
    to: "/reports",
    label: "Reports",
    shortLabel: "RP",
    roles: ["admin", "lagerleiter", "einkauf", "controller", "auditor"],
  },
  {
    to: "/alerts",
    label: "Alerts",
    shortLabel: "AL",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "einkauf", "controller", "versand"],
  },
  {
    to: "/goods-receipt",
    label: "Wareneingang",
    shortLabel: "WE",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "einkauf"],
  },
  {
    to: "/goods-issue",
    label: "Warenausgang",
    shortLabel: "WA",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "versand"],
  },
  {
    to: "/stock-transfer",
    label: "Umlagerung",
    shortLabel: "UM",
    roles: ["admin", "lagerleiter", "lagermitarbeiter"],
  },
  {
    to: "/inter-warehouse-transfer",
    label: "Inter-Warehouse",
    shortLabel: "IW",
    roles: ["admin", "lagerleiter", "lagermitarbeiter"],
  },
  {
    to: "/shipping",
    label: "Shipping",
    shortLabel: "SH",
    roles: ["admin", "lagerleiter", "versand"],
  },
  {
    to: "/scanner",
    label: "Scanner",
    shortLabel: "SC",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "einkauf", "versand"],
  },
];

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1100px)").matches : false
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  const onToggleNavigation = () => {
    if (isMobileLayout) {
      setIsMobileNavOpen((value) => !value);
      return;
    }

    setIsSidebarCollapsed((value) => !value);
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
            .filter((item) => !item.roles || item.roles.some((role) => user?.roles.includes(role)))
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
          {user?.roles.includes("admin") ? (
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              aria-label="Benutzerverwaltung"
              title="Benutzerverwaltung"
              onClick={() => {
                if (isMobileLayout) {
                  setIsMobileNavOpen(false);
                }
              }}
            >
              <span className="nav-link-short">BU</span>
              <span className="nav-link-label">Benutzerverwaltung</span>
            </NavLink>
          ) : null}
        </nav>
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
            <PwaStatus compact={isMobileLayout} />
            <OfflineSyncPanel compact={isMobileLayout} />
            <button className="btn" onClick={() => void logout()} data-testid="logout-btn">
              Logout
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
