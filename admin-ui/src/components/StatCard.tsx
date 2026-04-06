export function StatCard({ title, value, helper }: { title: string; value: string | number; helper: string }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}
