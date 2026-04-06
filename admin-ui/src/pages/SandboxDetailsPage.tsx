import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { useSandboxDetails } from "./hooks";

export function SandboxDetailsPage() {
  const { sandboxId = "" } = useParams();
  const navigate = useNavigate();
  const [endpointPort, setEndpointPort] = useState("8090");
  const [renewValue, setRenewValue] = useState("");
  const [useServerProxy, setUseServerProxy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const { sandbox, endpoint, loading, error, refresh, pause, resume, remove, renewExpiration } = useSandboxDetails(
    sandboxId,
    endpointPort,
    useServerProxy,
  );

  if (loading) return <LoadingBlock />;
  if (error || !sandbox) {
    return <EmptyState title="Không tải được sandbox" description={error || "Sandbox không tồn tại."} />;
  }

  const metadataEntries = Object.entries(sandbox.metadata || {});

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Operations"
        title={`Sandbox ${sandbox.id}`}
        subtitle="Chi tiết sandbox, endpoint lookup và các thao tác lifecycle chuẩn."
        actions={
          <>
            <button className="button" onClick={refresh}>Làm mới</button>
            <Link className="ghost-button" to="/sandboxes">Quay lại</Link>
            {sandbox.status.state === "Running" ? (
              <button
                className="ghost-button"
                disabled={busyAction === "pause"}
                onClick={async () => {
                  setBusyAction("pause");
                  setActionError("");
                  try {
                    await pause();
                  } catch (error) {
                    setActionError(error instanceof Error ? error.message : "Pause thất bại.");
                  } finally {
                    setBusyAction("");
                  }
                }}
              >
                Tạm dừng
              </button>
            ) : null}
            {sandbox.status.state === "Paused" ? (
              <button
                className="ghost-button"
                disabled={busyAction === "resume"}
                onClick={async () => {
                  setBusyAction("resume");
                  setActionError("");
                  try {
                    await resume();
                  } catch (error) {
                    setActionError(error instanceof Error ? error.message : "Resume thất bại.");
                  } finally {
                    setBusyAction("");
                  }
                }}
              >
                Tiếp tục
              </button>
            ) : null}
            <button
              className="ghost-button danger-button"
              disabled={busyAction === "delete"}
              onClick={async () => {
                setBusyAction("delete");
                setActionError("");
                try {
                  await remove();
                  navigate("/sandboxes");
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Xóa thất bại.");
                } finally {
                  setBusyAction("");
                }
              }}
            >
              Xóa
            </button>
          </>
        }
      />

      {actionError ? <div className="error-banner">{actionError}</div> : null}

      <section className="panel detail-grid">
        <div>
          <div className="panel-header"><h3>Thông tin chính</h3></div>
          <div className="key-value-list">
            <div><dt>Trạng thái</dt><dd><StatusBadge state={sandbox.status.state} /></dd></div>
            <div><dt>Thông điệp</dt><dd>{sandbox.status.message || "—"}</dd></div>
            <div><dt>Image</dt><dd className="inline-code">{sandbox.image.uri}</dd></div>
            <div><dt>Entrypoint</dt><dd className="inline-code">{sandbox.entrypoint?.join(" ") || "—"}</dd></div>
            <div><dt>Ngày tạo</dt><dd>{formatDate(sandbox.createdAt)} ({formatRelativeFromNow(sandbox.createdAt)})</dd></div>
            <div><dt>Hết hạn</dt><dd>{formatDate(sandbox.expiresAt)}</dd></div>
            <div><dt>Reason</dt><dd>{sandbox.status.reason || "—"}</dd></div>
            <div><dt>Last transition</dt><dd>{formatDate(sandbox.status.lastTransitionAt)}</dd></div>
          </div>
        </div>
        <div>
          <div className="panel-header"><h3>Tra endpoint</h3></div>
          <label>
            Cổng nội bộ
            <input className="text-input" value={endpointPort} onChange={(e) => setEndpointPort(e.target.value)} />
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={useServerProxy} onChange={(e) => setUseServerProxy(e.target.checked)} />
            Dùng use_server_proxy=true
          </label>
          <div className="panel subtle-panel">
            {endpoint ? (
              <>
                <div><strong>Endpoint:</strong> <span className="inline-code">{endpoint.endpoint}</span></div>
                <div className="helper-text">Headers: {endpoint.headers ? JSON.stringify(endpoint.headers) : "không có"}</div>
              </>
            ) : (
              <div className="helper-text">Chưa resolve được endpoint cho port này.</div>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Gia hạn TTL</h3></div>
        <div className="page-actions">
          <input className="text-input" type="datetime-local" value={renewValue} onChange={(e) => setRenewValue(e.target.value)} />
          <button
            className="button"
            disabled={!renewValue || busyAction === "renew"}
            onClick={async () => {
              setBusyAction("renew");
              setActionError("");
              try {
                await renewExpiration(new Date(renewValue).toISOString());
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "Gia hạn thất bại.");
              } finally {
                setBusyAction("");
              }
            }}
          >
            Gia hạn
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Metadata</h3></div>
        {metadataEntries.length === 0 ? (
          <div className="helper-text">Không có metadata.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody>
                {metadataEntries.map(([key, value]) => (
                  <tr key={key}><td>{key}</td><td>{String(value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
