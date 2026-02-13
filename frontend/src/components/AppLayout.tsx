import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

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
    to: "/reports",
    label: "Reports",
    shortLabel: "RP",
    roles: ["admin", "lagerleiter", "einkauf", "controller"],
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
    to: "/scanner",
    label: "Scanner",
    shortLabel: "SC",
    roles: ["admin", "lagerleiter", "lagermitarbeiter", "einkauf", "versand"],
  },
];

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`} data-testid="app-shell">
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
            >
              <span className="nav-link-short">{item.shortLabel}</span>
              <span className="nav-link-label">{item.label}</span>
            </NavLink>
          ))}
          {user?.roles.includes("admin") ? (
            <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} aria-label="Benutzerverwaltung" title="Benutzerverwaltung">
              <span className="nav-link-short">BU</span>
              <span className="nav-link-label">Benutzerverwaltung</span>
            </NavLink>
          ) : null}
        </nav>
      </aside>
      <div className="content-area">
        <header className="topbar">
          <button
            className="btn sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            data-testid="sidebar-toggle"
            aria-label={isSidebarCollapsed ? "Sidebar erweitern" : "Sidebar einklappen"}
          >
            {isSidebarCollapsed ? "»" : "«"}
          </button>
          <div className="topbar-user">
            <strong>{user?.username ?? "-"}</strong>
          </div>
          <div className="topbar-actions">
            <PwaStatus />
            <OfflineSyncPanel />
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
