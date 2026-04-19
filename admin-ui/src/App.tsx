import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingBlock } from "./components/LoadingBlock";

const AgentLabPage = lazy(() =>
  import("./pages/AgentLabPage").then((module) => ({ default: module.AgentLabPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const SandboxCreatePage = lazy(() =>
  import("./pages/SandboxCreatePage").then((module) => ({ default: module.SandboxCreatePage })),
);
const SandboxDetailsPage = lazy(() =>
  import("./pages/SandboxDetailsPage").then((module) => ({ default: module.SandboxDetailsPage })),
);
const SandboxListPage = lazy(() =>
  import("./pages/SandboxListPage").then((module) => ({ default: module.SandboxListPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock text="Loading page..." />}>
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
    </Suspense>
  );
}
