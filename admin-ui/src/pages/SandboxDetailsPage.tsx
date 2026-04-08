import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExecutionPanel from "../components/ExecutionPanel";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { getTemplateById } from "../lib/templates";
import { useSandboxDetails } from "./hooks";

function buildSurfaceUrl(
  endpointValue: string,
  kind: "execd" | "web" | "novnc" | "vnc" | "devtools",
  path?: string,
) {
  const endpoint = endpointValue.trim().replace(/^https?:\/\//, "");
  if (!endpoint) return "";

  if (kind === "novnc") {
    const [hostPort, ...rest] = endpoint.split("/");
    const [host, port] = hostPort.split(":");
    const proxyPath = rest.join("/");
    const noVncPath = (path ?? "/vnc.html").replace(/^\//, "");
    return `http://${hostPort}/${noVncPath}?host=${host}&port=${port}&path=${proxyPath}`;
  }

  if (kind === "web" || kind === "devtools") {
    const suffix = path ?? "";
    return `http://${endpoint}${suffix}`;
  }

  return endpoint;
}

export function SandboxDetailsPage() {
  const { sandboxId = "" } = useParams();
  const navigate = useNavigate();
  const [endpointPort, setEndpointPort] = useState("44772");
  const [renewValue, setRenewValue] = useState("");
  const [useServerProxy, setUseServerProxy] = useState(true);
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const { sandbox, endpoint, loading, error, refresh, pause, resume, remove, renewExpiration } = useSandboxDetails(
    sandboxId,
    endpointPort,
    useServerProxy,
  );

  const template = useMemo(() => {
    const templateId = String(sandbox?.metadata?.template ?? "custom");
    return getTemplateById(templateId);
  }, [sandbox?.metadata]);

  const activePortPreset = template.ports.find((port) => port.port === endpointPort) ?? template.ports[0];
  const surfaceUrl = endpoint ? buildSurfaceUrl(endpoint.endpoint, activePortPreset?.kind ?? "execd", activePortPreset?.path) : "";

  if (loading) return <LoadingBlock />;
  if (error || !sandbox) {
    return <EmptyState title="Không tải được sandbox" description={error || "Sandbox không tồn tại."} />;
  }

  const metadataEntries = Object.entries(sandbox.metadata || {});

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Sandbox Workbench"
        title={`Sandbox ${sandbox.id}`}
        subtitle="Lifecycle controls, endpoint routing, execd workbench và embedded surfaces cho agent workload này."
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
                  } catch (nextError) {
                    setActionError(nextError instanceof Error ? nextError.message : "Tạm dừng thất bại.");
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
                  } catch (nextError) {
                    setActionError(nextError instanceof Error ? nextError.message : "Tiếp tục thất bại.");
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
                } catch (nextError) {
                  setActionError(nextError instanceof Error ? nextError.message : "Xóa thất bại.");
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
          <div className="panel-header"><h3>Tổng quan</h3></div>
          <div className="key-value-list">
            <div><dt>Trạng thái</dt><dd><StatusBadge state={sandbox.status.state} /></dd></div>
            <div><dt>Template</dt><dd>{template.name}</dd></div>
            <div><dt>Thông điệp</dt><dd>{sandbox.status.message || "-"}</dd></div>
            <div><dt>Image</dt><dd className="inline-code">{sandbox.image.uri}</dd></div>
            <div><dt>Entrypoint</dt><dd className="inline-code">{sandbox.entrypoint?.join(" ") || "-"}</dd></div>
            <div><dt>Ngày tạo</dt><dd>{formatDate(sandbox.createdAt)} ({formatRelativeFromNow(sandbox.createdAt)})</dd></div>
            <div><dt>Hết hạn</dt><dd>{formatDate(sandbox.expiresAt)}</dd></div>
            <div><dt>Reason</dt><dd>{sandbox.status.reason || "-"}</dd></div>
            <div><dt>Last transition</dt><dd>{formatDate(sandbox.status.lastTransitionAt)}</dd></div>
          </div>
        </div>

        <div className="stack">
          <div className="panel subtle-panel">
            <div className="panel-header"><h3>Hướng dẫn theo template</h3></div>
            <div className="stack">
              <div className="helper-text">{template.description}</div>
              {template.recipe.map((line) => (
                <div className="helper-text" key={line}>{line}</div>
              ))}
              {template.bootstrapCommand ? (
                <div className="caption">Lệnh khởi tạo: {template.bootstrapCommand}</div>
              ) : null}
            </div>
          </div>

          <div className="panel subtle-panel">
            <div className="panel-header"><h3>TTL</h3></div>
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
                  } catch (nextError) {
                    setActionError(nextError instanceof Error ? nextError.message : "Gia hạn thất bại.");
                  } finally {
                    setBusyAction("");
                  }
                }}
              >
                Gia hạn
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Ports và Surfaces</h3>
        </div>
        <div className="surface-grid">
          {template.ports.map((port) => (
            <article className="surface-card" key={port.port}>
              <div className="surface-chip">{port.kind}</div>
              <h4>{port.label}</h4>
              <p>Port {port.port} bên trong sandbox</p>
              <div className="surface-actions">
                <button className="button secondary" type="button" onClick={() => setEndpointPort(port.port)}>
                  Resolve
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="panel subtle-panel">
          <label>
            Port hiện tại
            <input className="text-input" value={endpointPort} onChange={(e) => setEndpointPort(e.target.value)} />
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={useServerProxy} onChange={(e) => setUseServerProxy(e.target.checked)} />
            Dùng server proxy
          </label>
          {endpoint ? (
            <div className="stack">
              <div><strong>Endpoint:</strong> <span className="inline-code">{endpoint.endpoint}</span></div>
              <div className="helper-text">Headers: {endpoint.headers ? JSON.stringify(endpoint.headers) : "không có"}</div>
              {surfaceUrl && activePortPreset?.kind !== "execd" ? (
                <div className="page-actions">
                  <a className="button secondary" href={surfaceUrl} target="_blank" rel="noreferrer">
                    Mở surface
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="helper-text">Chưa resolve được endpoint cho port này.</div>
          )}
        </div>
      </section>

      {surfaceUrl && activePortPreset && ["web", "novnc", "devtools"].includes(activePortPreset.kind) ? (
        <section className="embedded-surface">
          <h4>Embedded Surface</h4>
          <p>
            Đang render <strong>{activePortPreset.label}</strong> qua endpoint proxied. Nếu app bên trong chặn iframe,
            bạn vẫn có thể mở nó trong tab mới.
          </p>
          <iframe className="embedded-frame" src={surfaceUrl} title={activePortPreset.label} />
        </section>
      ) : null}

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

      <ExecutionPanel
        endpoint={endpoint?.endpoint ?? ""}
        endpointHeaders={endpoint?.headers ?? {}}
        bootstrapCommand={template.bootstrapCommand}
      />
    </div>
  );
}
