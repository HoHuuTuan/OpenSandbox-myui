export function formatDate(value?: string | null) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatRelativeFromNow(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  if (minutes > 0) return `${minutes} phút trước`;
  return "vừa xong";
}

export function formatCount(value?: number | null) {
  if (value == null) return "0";
  return new Intl.NumberFormat().format(value);
}