import type { SandboxState } from "../types";

export function StatusBadge({ state }: { state: SandboxState }) {
  const normalized = String(state).toLowerCase();
  return <span className={`status-badge status-${normalized}`}>{state}</span>;
}
