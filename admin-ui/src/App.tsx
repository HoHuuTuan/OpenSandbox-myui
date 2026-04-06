import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { SandboxDetailsPage } from "./pages/SandboxDetailsPage";
import { SandboxListPage } from "./pages/SandboxListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SandboxCreatePage } from "./pages/SandboxCreatePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="/sandboxes" element={<SandboxListPage />} />
        <Route path="/sandboxes/new" element={<SandboxCreatePage />} />
        <Route path="/sandboxes/:sandboxId" element={<SandboxDetailsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
