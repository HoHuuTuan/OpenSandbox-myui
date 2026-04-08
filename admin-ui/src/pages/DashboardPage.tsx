import { Link } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { useSandboxCollection } from "./hooks";

export function DashboardPage() {
  const { items, loading, error, refresh } = useSandboxCollection({ state: "", metadata: "", pageSize: 100 });

  if (loading) return <LoadingBlock />;

  const counts = {
    total: items.length,
    running: items.filter((item) => item.status.state === "Running").length,
    paused: items.filter((item) => item.status.state === "Paused").length,
    stopped: items.filter((item) => ["Terminated", "Failed"].includes(item.status.state)).length,
  };

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Operations"
        title="Tổng quan"
        subtitle="Theo dõi nhanh trạng thái sandbox và đi tới workbench chi tiết cho từng agent workload."
        actions={<button className="button" onClick={refresh}>Làm mới</button>}
      />
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="grid stats-grid">
        <StatCard title="Tổng số" value={counts.total} helper="Tất cả sandbox hiện có" />
        <StatCard title="Đang chạy" value={counts.running} helper="State Running" />
        <StatCard title="Tạm dừng" value={counts.paused} helper="State Paused" />
        <StatCard title="Đã dừng/lỗi" value={counts.stopped} helper="Failed hoặc Terminated" />
      </div>
      <div className="panel">
        <div className="panel-header">
          <h3>Truy cập nhanh</h3>
        </div>
        <div className="page-actions">
          <Link className="button" to="/lab">Mở Agent Lab</Link>
          <Link className="ghost-button" to="/sandboxes">Mở danh sách sandbox</Link>
          <Link className="ghost-button" to="/settings">Cấu hình API</Link>
        </div>
      </div>
    </div>
  );
}
