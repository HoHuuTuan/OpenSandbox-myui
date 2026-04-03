export function LoadingBlock({ label = "Đang tải..." }: { label?: string }) {
  return <div className="loading-block">{label}</div>;
}
