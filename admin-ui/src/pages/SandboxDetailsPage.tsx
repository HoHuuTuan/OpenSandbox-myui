import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { KeyValueList } from "../components/KeyValueList";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { useSandboxAdminData, useSandboxDetails } from "./hooks";

export function SandboxDetailsPage() {
  const { sandboxId = "" } = useParams();
  const [actionError, setActionError] = useState("");
  const [renewValue, setRenewValue] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [newTag, setNewTag] = useState("");
  const {
    sandbox,
    loading,
    error,
    endpointPort,
    setEndpointPort,
    endpoint,
    refresh,
    pause,
    resume,
    remove,
    renewExpiration,
  } = useSandboxDetails(sandboxId);
  const {
    note,
    setNote,
    tags,
    saveNote,
    addTag,
    removeTag,
  } = useSandboxAdminData(sandboxId);

  if (loading) {
    return <LoadingBlock label="Đang tải chi tiết sandbox..." />;
  }

  if (error || !sandbox) {
    return <EmptyState title="Không truy cập được sandbox" body={error || "Không tìm thấy sandbox."} />;
  }

  const metadataEntries = Object.entries(sandbox.metadata || {});

  return (
    <div className="grid">
      <PageHeader
        title={`Sandbox ${sandbox.id}`}
        subtitle="Chi tiết sandbox, endpoint truy cập và các trường lifecycle chính."
        actions={
          <div className="page-actions">
            <button className="button" onClick={refresh}>
              Làm mới
            </button>
            <Link className="ghost-button" to={`/sandboxes/${sandbox.id}/terminal`}>
              Mở nhật ký
            </Link>
            {sandbox.status.state === "Running" ? (
              <button
                className="ghost-button"
                onClick={async () => {
                  setBusyAction("pause");
                  setActionError("");
                  try {
                    await pause();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Tạm dừng thất bại.");
                  } finally {
                    setBusyAction("");
                  }
                }}
                disabled={busyAction === "pause"}
              >
                Tạm dừng
              </button>
            ) : null}
            {sandbox.status.state === "Paused" ? (
              <button
                className="ghost-button"
                onClick={async () => {
                  setBusyAction("resume");
                  setActionError("");
                  try {
                    await resume();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Tiếp tục thất bại.");
                  } finally {
                    setBusyAction("");
                  }
                }}
                disabled={busyAction === "resume"}
              >
                Tiếp tục
              </button>
            ) : null}
            <button
              className="ghost-button"
              onClick={async () => {
                setBusyAction("delete");
                setActionError("");
                try {
                  await remove();
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : "Xóa thất bại.");
                } finally {
                  setBusyAction("");
                }
              }}
              disabled={busyAction === "delete"}
            >
              Xóa
            </button>
          </div>
        }
      />

      {actionError ? <EmptyState title="Tác vụ thất bại" body={actionError} /> : null}

      <section className="panel">
        <div className="panel-header">
          <h3>Trạng Thái Hiện Tại</h3>
          <StatusBadge state={sandbox.status.state} />
        </div>
        <p className="helper-text">{sandbox.status.message || "Không có thông điệp trạng thái."}</p>
      </section>

      <div className="detail-grid">
        <KeyValueList
          title="Vòng Đời"
          items={[
            { label: "ID", value: <span className="inline-code">{sandbox.id}</span> },
            { label: "Image", value: sandbox.image.uri },
            { label: "Ngày tạo", value: `${formatDate(sandbox.createdAt)} (${formatRelativeFromNow(sandbox.createdAt)})` },
            { label: "Hết hạn", value: formatDate(sandbox.expiresAt ?? undefined)},
            { label: "Lý do", value: sandbox.status.reason || "Chưa đặt" },
            { label: "Lần chuyển trạng thái cuối", value: formatDate(sandbox.status.lastTransitionAt) },
          ]}
        />

        <KeyValueList
          title="Thực Thi"
          items={[
            { label: "Lệnh khởi động", value: sandbox.entrypoint.join(" ") || "Chưa đặt" },
            { label: "Số metadata", value: String(metadataEntries.length) },
            { label: "Trạng thái", value: sandbox.status.state },
          ]}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Tra Endpoint</h3>
        </div>
        <div className="filters">
          <input
            className="text-input"
            value={endpointPort}
            onChange={(event) => setEndpointPort(event.target.value.replace(/\D/g, ""))}
            placeholder="Cổng bên trong sandbox, ví dụ 8090"
          />
          <button className="ghost-button" onClick={refresh}>
            Làm mới endpoint
          </button>
        </div>
        {endpoint ? (
          <div className="helper-text">
            <strong>Endpoint proxy:</strong> <span className="inline-code">{endpoint.endpoint}</span>
          </div>
        ) : (
          <p className="helper-text">Nhập cổng để tra endpoint proxy bằng lifecycle API hiện có.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Gia Hạn Hết Hạn</h3>
        </div>
        <div className="filters">
          <input
            className="text-input"
            type="datetime-local"
            value={renewValue}
            onChange={(event) => setRenewValue(event.target.value)}
          />
          <button
            className="ghost-button"
            onClick={async () => {
              if (!renewValue) {
                return;
              }

              setBusyAction("renew");
              setActionError("");
              try {
                await renewExpiration(new Date(renewValue).toISOString());
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Gia hạn thất bại.");
              } finally {
                setBusyAction("");
              }
            }}
            disabled={busyAction === "renew" || !renewValue}
          >
            Gia hạn
          </button>
        </div>
        <p className="helper-text">Đang dùng endpoint thật `POST /sandboxes/:id/renew-expiration`.</p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Tác Vụ Chưa Hỗ Trợ</h3>
        </div>
        <p className="helper-text">
          Không có endpoint backend riêng cho start hoặc restart sandbox. Start hiện được thực hiện ngầm qua `POST /sandboxes`, còn restart cần mở rộng backend trước khi UI có thể gọi thật.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Metadata</h3>
        </div>
        {metadataEntries.length === 0 ? (
          <p className="helper-text">Sandbox này không có metadata.</p>
        ) : (
          <div className="key-value-list">
            {metadataEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Ghi chú quản trị</h3>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nhập ghi chú nội bộ cho sandbox này"
          rows={6}
          style={{ width: "100%", marginTop: 12 }}
        />
        <div className="page-actions" style={{ marginTop: 12 }}>
          <button
            className="button"
            onClick={async () => {
              setActionError("");
              try {
                await saveNote();
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Lưu ghi chú thất bại.");
              }
            }}
          >
            Lưu ghi chú
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Tags</h3>
        <div className="page-actions" style={{ marginTop: 12 }}>
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            placeholder="Nhập tag"
          />
          <button
            className="button"
            onClick={async () => {
              if (!newTag.trim()) return;
              setActionError("");
              try {
                await addTag(newTag.trim());
                setNewTag("");
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Thêm tag thất bại.");
              }
            }}
          >
            Thêm tag
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <span
              key={tag.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
              }}
            >
              {tag.tag}
              <button
                className="ghost-button"
                onClick={async () => {
                  setActionError("");
                  try {
                    await removeTag(tag.id);
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : "Xóa tag thất bại.");
                  }
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
