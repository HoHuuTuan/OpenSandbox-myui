import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-kicker">OpenSandbox</span>
          <h1>Giao Diện Quản Trị</h1>
        </div>

        <nav className="nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Tổng Quan
          </NavLink>
          <NavLink to="/sandboxes" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Danh Sách Sandbox
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Cài Đặt
          </NavLink>
        </nav>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
