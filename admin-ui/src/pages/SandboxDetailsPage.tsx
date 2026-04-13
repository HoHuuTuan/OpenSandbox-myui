import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExecutionPanel from "../components/ExecutionPanel";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useSettings } from "../context/settings";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { fetchSandboxEndpoint, proxyPing, runSandboxCommand } from "../lib/api";
import { getTemplateById } from "../lib/templates";
import { useSandboxDetails } from "./hooks";

function prefersServerProxy(kind: "execd" | "web" | "novnc" | "vnc" | "devtools") {
  return kind !== "vnc";
}

function buildSurfaceUrl(
  endpointValue: string,
  kind: "execd" | "web" | "novnc" | "vnc" | "devtools",
  path?: string,
) {
  const endpoint = endpointValue.trim().replace(/^https?:\/\//, "");
  if (!endpoint) return "";
  const baseUrl = new URL(`http://${endpoint}`);

  if (kind === "novnc") {
    const noVncPath = (path ?? "/vnc.html").replace(/^\/+/, "");
    const proxyPath = baseUrl.pathname.replace(/\/$/, "");
    const pageUrl = new URL(`${proxyPath}/${noVncPath}`.replace(/\/{2,}/g, "/"), `${baseUrl.protocol}//${baseUrl.host}`);

    pageUrl.searchParams.set("autoconnect", "true");
    pageUrl.searchParams.set("reconnect", "true");
    pageUrl.searchParams.set("resize", "scale");
    pageUrl.searchParams.set("host", baseUrl.hostname);
    if (baseUrl.port) {
      pageUrl.searchParams.set("port", baseUrl.port);
    }
    if (proxyPath) {
      pageUrl.searchParams.set("path", `${proxyPath.replace(/^\/+/, "")}/websockify`);
    }

    return pageUrl.toString();
  }

  if (kind === "web" || kind === "devtools") {
    const suffix = (path ?? "").replace(/^\/+/, "");
    const joinedPath = suffix
      ? `${baseUrl.pathname.replace(/\/$/, "")}/${suffix}`.replace(/\/{2,}/g, "/")
      : baseUrl.pathname;
    return new URL(joinedPath, `${baseUrl.protocol}//${baseUrl.host}`).toString();
  }

  return endpoint;
}

export function SandboxDetailsPage() {
  const { sandboxId = "" } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [endpointPort, setEndpointPort] = useState("44772");
  const [renewValue, setRenewValue] = useState("");
  const [useServerProxy, setUseServerProxy] = useState(true);
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [actionNotice, setActionNotice] = useState("");
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
  const isDesktopTemplate = template.id === "desktop-agent";

  useEffect(() => {
    const matchingPreset = template.ports.find((port) => port.port === endpointPort);
    if (matchingPreset) {
      setUseServerProxy(prefersServerProxy(matchingPreset.kind));
    }
  }, [endpointPort, template.ports]);

  async function runDesktopAction(actionKey: string, command: string, successMessage: string) {
    if (!sandboxId) return;
    setBusyAction(actionKey);
    setActionError("");
    setActionNotice("");
    try {
      await runSandboxCommand(
        settings,
        sandboxId,
        {
          command,
          background: actionKey !== "verify-desktop",
          timeout: 60000,
        },
        "44772",
      );
      setActionNotice(successMessage);
      refresh();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Desktop action failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function openSurface(port: string) {
    if (!sandboxId) return;
    const preset = template.ports.find((item) => item.port === port);
    if (!preset) return;

    setBusyAction(`open-${port}`);
    setActionError("");
    setActionNotice("");

    try {
      const nextEndpoint = await fetchSandboxEndpoint(
        settings,
        sandboxId,
        port,
        prefersServerProxy(preset.kind),
      );
      const nextUrl = buildSurfaceUrl(nextEndpoint.endpoint, preset.kind, preset.path);
      if (!nextUrl) {
        throw new Error("Surface URL is empty.");
      }
      setEndpointPort(port);
      setUseServerProxy(prefersServerProxy(preset.kind));
      window.open(nextUrl, "_blank", "noopener,noreferrer");
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Không mở được surface.");
    } finally {
      setBusyAction("");
    }
  }

  async function verifyExecd() {
    if (!sandboxId) return;
    setBusyAction("verify-execd");
    setActionError("");
    setActionNotice("");
    try {
      await proxyPing(settings, sandboxId, "44772");
      if (template.verifyCommand) {
        await runSandboxCommand(
          settings,
          sandboxId,
          {
            command: template.verifyCommand,
            background: false,
            timeout: 30000,
          },
          "44772",
        );
      }
      setActionNotice("execd phản hồi bình thường và desktop surfaces chính đã qua kiểm tra nhanh.");
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "execd verification thất bại.");
    } finally {
      setBusyAction("");
    }
  }

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
      {actionNotice ? <div className="panel subtle-panel">{actionNotice}</div> : null}

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

      {isDesktopTemplate ? (
        <section className="panel">
          <div className="panel-header">
            <h3>Desktop Actions</h3>
          </div>
          <div className="page-actions">
            <button
              className="button"
              disabled={busyAction === "open-6080"}
              onClick={() => void openSurface("6080")}
              type="button"
            >
              Open noVNC
            </button>
            <button
              className="ghost-button"
              disabled={!template.bootstrapCommand || busyAction === "bootstrap-desktop"}
              onClick={() => template.bootstrapCommand && void runDesktopAction("bootstrap-desktop", template.bootstrapCommand, "Desktop bootstrap command đã được gửi qua execd.")}
              type="button"
            >
              Bootstrap Desktop
            </button>
            <button
              className="ghost-button"
              disabled={!template.restartCommand || busyAction === "restart-desktop"}
              onClick={() => template.restartCommand && void runDesktopAction("restart-desktop", template.restartCommand, "Desktop stack đang được restart.")}
              type="button"
            >
              Restart Desktop
            </button>
            <button
              className="ghost-button"
              disabled={busyAction === "verify-execd"}
              onClick={() => void verifyExecd()}
              type="button"
            >
              Verify execd
            </button>
            {template.openBrowserCommand ? (
              <button
                className="ghost-button"
                disabled={busyAction === "open-browser"}
                onClick={() => void runDesktopAction("open-browser", template.openBrowserCommand!, "Chromium launch command đã được gửi vào desktop sandbox.")}
                type="button"
              >
                Open Browser
              </button>
            ) : null}
          </div>
          <div className="helper-text">
            Desktop dev sandboxes tự khởi động từ image entrypoint. Các nút này là đường phục hồi nhanh khi cần bật lại desktop stack hoặc mở browser bên trong sandbox.
          </div>
        </section>
      ) : null}

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
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setEndpointPort(port.port);
                    setUseServerProxy(prefersServerProxy(port.kind));
                  }}
                >
                  Resolve
                </button>
                {["web", "novnc", "devtools"].includes(port.kind) ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void openSurface(port.port)}
                  >
                    Open
                  </button>
                ) : null}
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
