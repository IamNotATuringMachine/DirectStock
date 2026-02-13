import { NavLink, Outlet } from "react-router-dom";

import PwaStatus from "./pwa/PwaStatus";
import { useAuthStore } from "../stores/authStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/products", label: "Artikelstamm" },
  { to: "/warehouse", label: "Lagerstruktur" },
  { to: "/inventory", label: "Bestandsübersicht" },
  { to: "/goods-receipt", label: "Wareneingang" },
  { to: "/goods-issue", label: "Warenausgang" },
  { to: "/stock-transfer", label: "Umlagerung" },
  { to: "/scanner", label: "Scanner" },
];

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand">DirectStock</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          {user?.roles.includes("admin") ? (
            <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Benutzerverwaltung
            </NavLink>
          ) : null}
        </nav>
      </aside>
      <div className="content-area">
        <header className="topbar">
          <div className="topbar-user">
            <strong>{user?.username ?? "-"}</strong>
          </div>
          <div className="topbar-actions">
            <PwaStatus />
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
