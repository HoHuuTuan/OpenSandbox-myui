import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AgentLabPage } from "./pages/AgentLabPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SandboxCreatePage } from "./pages/SandboxCreatePage";
import { SandboxDetailsPage } from "./pages/SandboxDetailsPage";
import { SandboxListPage } from "./pages/SandboxListPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/lab" replace />} />
        <Route path="lab" element={<AgentLabPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="/sandboxes" element={<SandboxListPage />} />
        <Route path="/sandboxes/new" element={<SandboxCreatePage />} />
        <Route path="/sandboxes/:sandboxId" element={<SandboxDetailsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
