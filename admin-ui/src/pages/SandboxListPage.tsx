import { useState } from "react";
import { Link } from "react-router-dom";

import { CreateSandboxForm } from "../components/CreateSandboxForm";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import { useSandboxCollection } from "./hooks";

export function SandboxListPage() {
  const { sandboxes, loading, error, refresh, create, pause, resume, remove } = useSandboxCollection();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [createError, setCreateError] = useState("");

  const filtered = sandboxes.filter((sandbox) => {
    const matchesState = state === "all" || sandbox.status.state === state;
    const haystack = [
      sandbox.id,
      sandbox.image.uri,
      sandbox.status.state,
      ...(sandbox.entrypoint || []),
      ...Object.entries(sandbox.metadata || {}).flat(),
    ]
      .join(" ")
      .toLowerCase();

    return matchesState && haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="grid">
      <PageHeader
        title="Danh Sách Sandbox"
        subtitle="Lọc và duyệt toàn bộ sandbox hiện có từ lifecycle API."
        actions={
          <button className="button" onClick={refresh}>
            Làm mới
          </button>
        }
      />

      <CreateSandboxForm
        busy={busyId === "create"}
        onCreate={async (request) => {
          setBusyId("create");
          setCreateError("");
          try {
            await create(request);
          } catch (err) {
            setCreateError(err instanceof Error ? err.message : "Tạo sandbox thất bại.");
          } finally {
            setBusyId("");
          }
        }}
      />

      {createError ? <EmptyState title="Tạo sandbox thất bại" body={createError} /> : null}

      <section className="panel">
        <div className="panel-header">
          <h3>Ánh Xạ Vòng Đời</h3>
        </div>
        <p className="helper-text">
          Backend hiện có: create auto-starts sandbox, pause/resume điều khiển trạng thái, delete sẽ terminate. Không có endpoint start hoặc restart riêng trong repo.
        </p>
      </section>

      <section className="panel">
        <div className="filters">
          <input
            className="search-input"
            placeholder="Tìm theo id, image, trạng thái, metadata..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select className="select-input" value={state} onChange={(event) => setState(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="Pending">Đang chờ</option>
            <option value="Running">Đang chạy</option>
            <option value="Pausing">Pausing</option>
            <option value="Paused">Tạm dừng</option>
            <option value="Stopping">Stopping</option>
            <option value="Terminated">Terminated</option>
            <option value="Failed">Thất bại</option>
          </select>
        </div>
      </section>

      {error ? <EmptyState title="Không tải được danh sách sandbox" body={error} /> : null}
      {loading ? <LoadingBlock label="Đang tải danh sách sandbox..." /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState title="Không có kết quả phù hợp" body="Hãy mở rộng điều kiện tìm kiếm hoặc kiểm tra cài đặt server." />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <section className="panel">
          <DataTable headers={["Sandbox", "Image", "Trạng Thái", "Ngày Tạo", "Tác Vụ"]}>
            {filtered.map((sandbox) => (
              <tr key={sandbox.id}>
                <td>
                  <div className="inline-code">{sandbox.id}</div>
                </td>
                <td>{sandbox.image.uri}</td>
                <td>
                  <StatusBadge state={sandbox.status.state} />
                </td>
                <td>{formatDate(sandbox.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <Link className="ghost-button" to={`/sandboxes/${sandbox.id}`}>
                      Chi tiết
                    </Link>
                    <Link className="ghost-button" to={`/sandboxes/${sandbox.id}/terminal`}>
                      Nhật ký
                    </Link>
                    {sandbox.status.state === "Running" ? (
                      <button
                        className="ghost-button"
                        onClick={async () => {
                          setBusyId(`pause:${sandbox.id}`);
                          try {
                            await pause(sandbox.id);
                          } finally {
                            setBusyId("");
                          }
                        }}
                        disabled={busyId === `pause:${sandbox.id}`}
                      >
                        Tạm dừng
                      </button>
                    ) : null}
                    {sandbox.status.state === "Paused" ? (
                      <button
                        className="ghost-button"
                        onClick={async () => {
                          setBusyId(`resume:${sandbox.id}`);
                          try {
                            await resume(sandbox.id);
                          } finally {
                            setBusyId("");
                          }
                        }}
                        disabled={busyId === `resume:${sandbox.id}`}
                      >
                        Tiếp tục
                      </button>
                    ) : null}
                    <button
                      className="ghost-button"
                      onClick={async () => {
                        setBusyId(`delete:${sandbox.id}`);
                        try {
                          await remove(sandbox.id);
                        } finally {
                          setBusyId("");
                        }
                      }}
                      disabled={busyId === `delete:${sandbox.id}`}
                    >
                      Xóa
                    </button>
                    <button className="ghost-button" disabled title="Backend hiện chưa có endpoint restart">
                      Chưa hỗ trợ restart
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}
