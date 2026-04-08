import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-kicker">OpenSandbox</span>
          <h1>Agent Lab</h1>
          <p className="sidebar-subtitle">
            Lifecycle, execd, browser ports và desktop surfaces cho việc test agent.
          </p>
        </div>
        <nav className="nav">
          <NavLink className="nav-link" to="/lab">
            Agent Lab
          </NavLink>
          <NavLink className="nav-link" to="/dashboard">
            Tổng quan
          </NavLink>
          <NavLink className="nav-link" to="/sandboxes">
            Sandbox Workloads
          </NavLink>
          <NavLink className="nav-link" to="/sandboxes/new">
            Tạo từ template
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
