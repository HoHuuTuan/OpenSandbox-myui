import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-kicker">OpenSandbox</span>
          <h1>Giao diện quản trị</h1>
          <p className="sidebar-subtitle">UI này gọi trực tiếp OpenSandbox Lifecycle API.</p>
        </div>
        <nav className="nav">
          <NavLink className="nav-link" to="/dashboard">
            Tổng quan
          </NavLink>
          <NavLink className="nav-link" to="/sandboxes">
            Danh sách sandbox
          </NavLink>
          <NavLink className="nav-link" to="/settings">
            Cài đặt API
          </NavLink>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
