export function LoadingBlock({ text = "Đang tải dữ liệu..." }: { text?: string }) {
  return <div className="loading-block">{text}</div>;
}
