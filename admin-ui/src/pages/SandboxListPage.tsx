import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { useSandboxCollection } from "./hooks";

export function SandboxListPage() {
  const [stateFilter, setStateFilter] = useState("");
  const [metadataFilter, setMetadataFilter] = useState("");

  const filters = useMemo(
    () => ({ state: stateFilter, metadata: metadataFilter, pageSize: 50 }),
    [metadataFilter, stateFilter]
  );

  const { items, loading, error, refresh } = useSandboxCollection(filters);

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Inventory"
        title="Danh sách sandbox"
        subtitle="Gọi trực tiếp các endpoint chuẩn của OpenSandbox Lifecycle API."
        actions={
          <div style={{ display: "flex", gap: 12 }}>
            <Link className="button secondary" to="/sandboxes/new">
              Tạo sandbox
            </Link>
            <button className="button" onClick={refresh}>
              Làm mới
            </button>
          </div>
        }
      />

      <div className="panel filters">
        <select
          className="select-input"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Pending">Pending</option>
          <option value="Running">Running</option>
          <option value="Paused">Paused</option>
          <option value="Failed">Failed</option>
          <option value="Terminated">Terminated</option>
        </select>

        <input
          className="search-input"
          placeholder="VD: project=demo"
          value={metadataFilter}
          onChange={(e) => setMetadataFilter(e.target.value)}
        />
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <h3>Sandbox hiện có</h3>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : !Array.isArray(items) || items.length === 0 ? (
          <EmptyState
            title="Chưa có sandbox phù hợp"
            description="Thử đổi filter hoặc tạo sandbox mới."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Image</th>
                  <th>Trạng thái</th>
                  <th>Tạo lúc</th>
                  <th>Hết hạn</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((sandbox) => (
                  <tr key={sandbox.id}>
                    <td className="inline-code">{sandbox.id}</td>
                    <td>{sandbox.image?.uri ?? "—"}</td>
                    <td>
                      <StatusBadge state={sandbox.status.state} />
                    </td>
                    <td>
                      {formatDate(sandbox.createdAt)}
                      <div className="helper-text">
                        {formatRelativeFromNow(sandbox.createdAt)}
                      </div>
                    </td>
                    <td>{formatDate(sandbox.expiresAt)}</td>
                    <td>
                      <Link className="ghost-button" to={`/sandboxes/${sandbox.id}`}>
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}