export function StatusBadge({ state }: { state: string }) {
  const tone = state.toLowerCase();
  return <span className={`status-badge status-${tone}`}>{state}</span>;
}
