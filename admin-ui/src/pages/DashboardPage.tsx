import { Link } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { formatCount, formatDate, formatRelativeFromNow } from "../lib/format";
import { useSandboxCollection } from "./hooks";

export function DashboardPage() {
  const { sandboxes, loading, error, refresh } = useSandboxCollection();

  const running = sandboxes.filter((item) => item.status.state === "Running").length;
  const pending = sandboxes.filter((item) => item.status.state === "Pending").length;
  const failed = sandboxes.filter((item) => item.status.state === "Failed").length;
  const recent = [...sandboxes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="grid">
      <PageHeader
        title="Tổng Quan"
        subtitle="Một góc nhìn nhanh về vòng đời sandbox, trạng thái hiện tại và các phiên bản mới nhất."
        actions={
          <button className="button" onClick={refresh}>
            Làm mới
          </button>
        }
      />

      {error ? <EmptyState title="Không tải được danh sách sandbox" body={error} /> : null}
      {loading ? <LoadingBlock label="Đang tải dữ liệu tổng quan..." /> : null}

      <div className="grid stats-grid">
        <StatCard label="Tổng số sandbox" value={formatCount(sandboxes.length)} hint="Tính trên mọi trạng thái hiện có" />
        <StatCard label="Đang chạy" value={formatCount(running)} hint="Đang phục vụ workload" />
        <StatCard label="Đang chờ" value={formatCount(pending)} hint="Đang provision hoặc khởi động" />
        <StatCard label="Thất bại" value={formatCount(failed)} hint="Cần người vận hành xử lý" />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h3>Sandbox Gần Đây</h3>
            <Link className="ghost-button" to="/sandboxes">
              Xem tất cả
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="Chưa có sandbox" body="Hãy tạo sandbox mới hoặc kết nối tới server đang chạy để xem dữ liệu." />
          ) : (
            <div className="grid">
              {recent.map((sandbox) => (
                <Link key={sandbox.id} className="panel" to={`/sandboxes/${sandbox.id}`}>
                  <div className="panel-header">
                    <strong>{sandbox.id}</strong>
                    <StatusBadge state={sandbox.status.state} />
                  </div>
                  <div className="helper-text">{sandbox.image.uri}</div>
                  <div className="helper-text">
                    Tạo {formatRelativeFromNow(sandbox.createdAt)} | {formatDate(sandbox.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Ghi Chú Vận Hành</h3>
          </div>
          <div className="grid">
            <span className="route-chip">POST /v1/sandboxes</span>
            <span className="route-chip">GET /v1/sandboxes</span>
            <span className="route-chip">GET /v1/sandboxes/:id</span>
            <span className="route-chip">GET /v1/sandboxes/:id/diagnostics/summary</span>
            <span className="route-chip">Backend chưa có endpoint restart</span>
            <p className="helper-text">
              Sandbox được tự động khởi động khi tạo. Pause, resume, terminate, tra endpoint và diagnostics đều đang dùng trực tiếp các route backend hiện có.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
