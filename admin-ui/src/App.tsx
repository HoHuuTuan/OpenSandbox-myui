import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { SandboxDetailsPage } from "./pages/SandboxDetailsPage";
import { SandboxListPage } from "./pages/SandboxListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TerminalPage } from "./pages/TerminalPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sandboxes" element={<SandboxListPage />} />
        <Route path="/sandboxes/:sandboxId" element={<SandboxDetailsPage />} />
        <Route path="/sandboxes/:sandboxId/terminal" element={<TerminalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}
