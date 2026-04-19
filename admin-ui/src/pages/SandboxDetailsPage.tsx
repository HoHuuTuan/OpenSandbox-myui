import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExecutionPanel from "../components/ExecutionPanel";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useSettings } from "../context/settings";
import { formatDate, formatRelativeFromNow } from "../lib/format";
import { fetchSandboxEndpoint, fetchSandboxProxyHealth, runSandboxCommand } from "../lib/api";
import { getTemplateById, type PortPreset } from "../lib/templates";
import { useSandboxDetails } from "./hooks";

const SURFACE_KINDS = new Set<PortPreset["kind"]>(["web", "novnc", "devtools"]);
const OPENCLAW_WAIT_TIMEOUT_MS = 90000;
const OPENCLAW_WAIT_INTERVAL_MS = 1000;
const OPENCLAW_HEALTH_POLL_MS = 3000;

function prefersServerProxy(port: PortPreset) {
  return port.kind !== "web";
}

function isSurfacePort(port: PortPreset) {
  return SURFACE_KINDS.has(port.kind);
}

function normalizeBrowserEndpoint(endpointValue: string) {
  const trimmed = endpointValue.trim();
  if (!trimmed) return null;

  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `${protocol}//${trimmed}`;
  const url = new URL(withScheme);

  if (
    typeof window !== "undefined" &&
    ["host.docker.internal", "0.0.0.0", "::"].includes(url.hostname)
  ) {
    url.hostname = window.location.hostname || "127.0.0.1";
  }

  return url;
}

function ensureDirectoryPath(pathname: string) {
  const normalized = pathname || "/";
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function buildSurfaceUrl(endpointValue: string, port: PortPreset) {
  const baseUrl = normalizeBrowserEndpoint(endpointValue);
  if (!baseUrl) return "";

  const rootUrl = `${baseUrl.protocol}//${baseUrl.host}`;
  const directoryUrl = new URL(ensureDirectoryPath(baseUrl.pathname), rootUrl);

  if (port.kind === "novnc") {
    const noVncPath = (port.path ?? "/vnc.html").replace(/^\/+/, "");
    const proxyPath = ensureDirectoryPath(baseUrl.pathname);
    const pageUrl = new URL(noVncPath, directoryUrl);

    pageUrl.searchParams.set("autoconnect", "true");
    pageUrl.searchParams.set("reconnect", "true");
    pageUrl.searchParams.set("resize", "scale");
    pageUrl.searchParams.set("host", baseUrl.hostname);

    if (baseUrl.port) {
      pageUrl.searchParams.set("port", baseUrl.port);
    }
    if (proxyPath !== "/") {
      pageUrl.searchParams.set("path", `${proxyPath.replace(/^\/+/, "")}websockify`);
    }

    return pageUrl.toString();
  }

  if (port.kind === "web" || port.kind === "devtools") {
    const suffix = (port.path ?? "").replace(/^\/+/, "");
    return suffix ? new URL(suffix, directoryUrl).toString() : directoryUrl.toString();
  }

  return baseUrl.toString();
}

function createLoadingWindow() {
  const child = window.open("about:blank", "_blank");
  if (!child) return null;

  child.opener = null;
  child.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Opening OpenClaw</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0f1117;
        color: #f5f7fb;
        font: 16px/1.5 ui-sans-serif, system-ui, sans-serif;
      }
      .card {
        max-width: 440px;
        padding: 24px 28px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 20px;
      }
      p {
        margin: 0;
        color: rgba(245,247,251,0.78);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Opening OpenClaw</h1>
      <p>The gateway is still starting. This tab will redirect as soon as the dashboard is ready.</p>
    </div>
  </body>
</html>`);
  child.document.close();
  return child;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateLoadingWindow(child: Window | null, title: string, message: string) {
  if (!child || child.closed) return;

  child.document.title = title;
  child.document.body.innerHTML = `
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

async function waitForOpenClawReady(
  settings: ReturnType<typeof useSettings>["settings"],
  sandboxId: string,
  portNumber: string,
) {
  const deadline = Date.now() + OPENCLAW_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await fetchSandboxProxyHealth(settings, sandboxId, portNumber);
      return;
    } catch {
      // Ignore transient startup failures and keep polling.
    }

    await new Promise((resolve) => window.setTimeout(resolve, OPENCLAW_WAIT_INTERVAL_MS));
  }

  throw new Error("OpenClaw is still starting. Wait a bit longer, then try again.");
}

async function verifyExecd(endpoint?: string) {
  const baseUrl = normalizeBrowserEndpoint(endpoint ?? "");
  if (!baseUrl) {
    alert("Endpoint is not available yet.");
    return;
  }

  try {
    const pingUrl = new URL("ping", `${baseUrl.origin}${ensureDirectoryPath(baseUrl.pathname)}`).toString();
    const res = await fetch(pingUrl);
    alert(res.ok ? "execd is reachable." : "execd returned a non-OK response.");
  } catch {
    alert("Could not reach execd.");
  }
}

export function SandboxDetailsPage() {
  const { sandboxId = "" } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [endpointPort, setEndpointPort] = useState("44772");
  const [renewValue, setRenewValue] = useState("");
  const [useServerProxy, setUseServerProxy] = useState(true);
  const [execdEndpoint, setExecdEndpoint] = useState("");
  const [execdEndpointHeaders, setExecdEndpointHeaders] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [openClawReady, setOpenClawReady] = useState(false);

  const { sandbox, endpoint, loading, error, refresh, pause, resume, remove, renewExpiration } = useSandboxDetails(
    sandboxId,
    endpointPort,
    useServerProxy,
  );

  const template = useMemo(() => {
    const templateId = String(sandbox?.metadata?.template ?? "custom");
    return getTemplateById(templateId);
  }, [sandbox?.metadata]);

  const activePortPreset = useMemo(
    () => template.ports.find((port) => port.port === endpointPort) ?? template.ports[0],
    [endpointPort, template.ports],
  );
  const surfaceUrl = useMemo(
    () => (endpoint && activePortPreset ? buildSurfaceUrl(endpoint.endpoint, activePortPreset) : ""),
    [activePortPreset, endpoint],
  );
  const isDesktopTemplate = template.id === "desktop-agent";
  const isOpenClawTemplate = template.id.startsWith("openclaw-");
  const isOpenClawSurface = isOpenClawTemplate && activePortPreset.kind === "web";
  const showEmbeddedSurface = Boolean(
    surfaceUrl &&
    isSurfacePort(activePortPreset) &&
    (!isOpenClawSurface || openClawReady),
  );
  const metadataEntries = useMemo(() => Object.entries(sandbox?.metadata || {}), [sandbox?.metadata]);

  useEffect(() => {
    const matchingPreset = template.ports.find((port) => port.port === endpointPort);
    if (matchingPreset) {
      setUseServerProxy(prefersServerProxy(matchingPreset));
    }
  }, [endpointPort, template.ports]);

  useEffect(() => {
    let cancelled = false;

    async function loadExecdEndpoint() {
      if (!sandboxId) {
        if (!cancelled) {
          setExecdEndpoint("");
          setExecdEndpointHeaders({});
        }
        return;
      }

      try {
        const response = await fetchSandboxEndpoint(settings, sandboxId, "44772", true);
        if (!cancelled) {
          setExecdEndpoint(response.endpoint);
          setExecdEndpointHeaders(response.headers ?? {});
        }
      } catch {
        if (!cancelled) {
          setExecdEndpoint("");
          setExecdEndpointHeaders({});
        }
      }
    }

    void loadExecdEndpoint();

    return () => {
      cancelled = true;
    };
  }, [sandboxId, settings]);

  useEffect(() => {
    if (!sandboxId || !isOpenClawTemplate || sandbox?.status.state !== "Running") {
      setOpenClawReady(false);
      return;
    }

    let cancelled = false;

    async function checkHealth() {
      try {
        await fetchSandboxProxyHealth(settings, sandboxId, "8080");
        if (!cancelled) {
          setOpenClawReady(true);
        }
      } catch {
        if (!cancelled) {
          setOpenClawReady(false);
        }
      }
    }

    void checkHealth();
    const timer = window.setInterval(() => {
      void checkHealth();
    }, OPENCLAW_HEALTH_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpenClawTemplate, sandbox?.status.state, sandboxId, settings]);

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

  async function openSurface(portNumber: string) {
    if (!sandboxId) return;

    const port = template.ports.find((item) => item.port === portNumber);
    if (!port) return;
    const isOpenClawPort = isOpenClawTemplate && port.kind === "web";
    const loadingWindow = isOpenClawPort ? createLoadingWindow() : null;

    setBusyAction(`open-${portNumber}`);
    setActionError("");
    setActionNotice("");

    try {
      const response = await fetchSandboxEndpoint(settings, sandboxId, portNumber, prefersServerProxy(port));
      const finalUrl = buildSurfaceUrl(response.endpoint, port);

      if (!finalUrl) {
        throw new Error("Surface URL is empty.");
      }

      setEndpointPort(portNumber);
      setUseServerProxy(prefersServerProxy(port));

      if (isOpenClawPort) {
        await waitForOpenClawReady(settings, sandboxId, portNumber);
        setOpenClawReady(true);
      }

      if (loadingWindow) {
        loadingWindow.location.replace(finalUrl);
      } else {
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      }
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Could not open the selected surface.";
      updateLoadingWindow(
        loadingWindow,
        "OpenClaw is not ready",
        `${message} Return to the sandbox page, wait for the gateway health to turn live, then try again.`,
      );
      setActionError(message);
    } finally {
      setBusyAction("");
    }
  }

  async function handlePause() {
    setBusyAction("pause");
    setActionError("");
    try {
      await pause();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Pause failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleResume() {
    setBusyAction("resume");
    setActionError("");
    try {
      await resume();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Resume failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete() {
    setBusyAction("delete");
    setActionError("");
    try {
      await remove();
      navigate("/sandboxes");
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Delete failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleRenew() {
    if (!renewValue) return;

    setBusyAction("renew");
    setActionError("");
    try {
      await renewExpiration(new Date(renewValue).toISOString());
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Renew failed.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) return <LoadingBlock />;
  if (error || !sandbox) {
    return <EmptyState title="Sandbox unavailable" description={error || "The sandbox could not be found."} />;
  }

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Sandbox Workbench"
        title={`Sandbox ${sandbox.id}`}
        subtitle="Lifecycle controls, endpoint routing, execd workbench, and browser surfaces for this workload."
        actions={
          <>
            <button className="button" onClick={refresh}>Refresh</button>
            <Link className="ghost-button" to="/sandboxes">Back</Link>
            {sandbox.status.state === "Running" ? (
              <button className="ghost-button" disabled={busyAction === "pause"} onClick={() => void handlePause()}>
                Pause
              </button>
            ) : null}
            {sandbox.status.state === "Paused" ? (
              <button className="ghost-button" disabled={busyAction === "resume"} onClick={() => void handleResume()}>
                Resume
              </button>
            ) : null}
            <button className="ghost-button danger-button" disabled={busyAction === "delete"} onClick={() => void handleDelete()}>
              Delete
            </button>
          </>
        }
      />

      {actionError ? <div className="error-banner">{actionError}</div> : null}
      {actionNotice ? <div className="panel subtle-panel">{actionNotice}</div> : null}

      <section className="panel detail-grid">
        <div>
          <div className="panel-header"><h3>Overview</h3></div>
          <div className="key-value-list">
            <div><dt>Status</dt><dd><StatusBadge state={sandbox.status.state} /></dd></div>
            <div><dt>Template</dt><dd>{template.name}</dd></div>
            <div><dt>Message</dt><dd>{sandbox.status.message || "-"}</dd></div>
            <div><dt>Image</dt><dd className="inline-code">{sandbox.image.uri}</dd></div>
            <div><dt>Entrypoint</dt><dd className="inline-code">{sandbox.entrypoint?.join(" ") || "-"}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(sandbox.createdAt)} ({formatRelativeFromNow(sandbox.createdAt)})</dd></div>
            <div><dt>Expires</dt><dd>{formatDate(sandbox.expiresAt)}</dd></div>
            <div><dt>Reason</dt><dd>{sandbox.status.reason || "-"}</dd></div>
            <div><dt>Last transition</dt><dd>{formatDate(sandbox.status.lastTransitionAt)}</dd></div>
          </div>
        </div>

        <div className="stack">
          <div className="panel subtle-panel">
            <div className="panel-header"><h3>Template notes</h3></div>
            <div className="stack">
              <div className="helper-text">{template.description}</div>
              {template.recipe.map((line) => (
                <div className="helper-text" key={line}>{line}</div>
              ))}
              {template.bootstrapCommand ? (
                <div className="caption">Bootstrap command: {template.bootstrapCommand}</div>
              ) : null}
            </div>
          </div>

          <div className="panel subtle-panel">
            <div className="panel-header"><h3>TTL</h3></div>
            <div className="page-actions">
              <input className="text-input" type="datetime-local" value={renewValue} onChange={(e) => setRenewValue(e.target.value)} />
              <button className="button" disabled={!renewValue || busyAction === "renew"} onClick={() => void handleRenew()}>
                Renew
              </button>
            </div>
          </div>
        </div>
      </section>

      {isDesktopTemplate ? (
        <section className="panel">
          <div className="panel-header"><h3>Desktop actions</h3></div>
          <div className="page-actions">
            <button className="button" disabled={busyAction === "open-6080"} onClick={() => void openSurface("6080")} type="button">
              Open noVNC
            </button>
            <button
              className="ghost-button"
              disabled={!template.bootstrapCommand || busyAction === "bootstrap-desktop"}
              onClick={() => template.bootstrapCommand && void runDesktopAction("bootstrap-desktop", template.bootstrapCommand, "Desktop bootstrap command was sent through execd.")}
              type="button"
            >
              Bootstrap
            </button>
            <button
              className="ghost-button"
              disabled={!template.restartCommand || busyAction === "restart-desktop"}
              onClick={() => template.restartCommand && void runDesktopAction("restart-desktop", template.restartCommand, "Desktop stack restart was requested.")}
              type="button"
            >
              Restart
            </button>
            <button className="ghost-button" disabled={busyAction === "verify-execd"} onClick={() => void verifyExecd(execdEndpoint)} type="button">
              Verify execd
            </button>
            {template.openBrowserCommand ? (
              <button
                className="ghost-button"
                disabled={busyAction === "open-browser"}
                onClick={() => void runDesktopAction("open-browser", template.openBrowserCommand!, "Browser launch command was sent to the desktop sandbox.")}
                type="button"
              >
                Open browser
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header"><h3>Ports and surfaces</h3></div>
        <div className="surface-grid">
          {template.ports.map((port) => (
            <article className="surface-card" key={port.port}>
              <div className="surface-chip">{port.kind}</div>
              <h4>{port.label}</h4>
              <p>Port {port.port} inside the sandbox</p>
              <div className="surface-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setEndpointPort(port.port);
                    setUseServerProxy(prefersServerProxy(port));
                  }}
                >
                  Resolve
                </button>
                {isSurfacePort(port) && (!isOpenClawTemplate || port.kind !== "web" || openClawReady) ? (
                  <button className="ghost-button" type="button" onClick={() => void openSurface(port.port)}>
                    Open
                  </button>
                ) : null}
              </div>
              {isOpenClawTemplate && port.kind === "web" && !openClawReady ? (
                <div className="helper-text">
                  OpenClaw gateway is still starting. The Open button will appear after `/healthz` is live.
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="panel subtle-panel">
          <label>
            Active port
            <input className="text-input" value={endpointPort} onChange={(e) => setEndpointPort(e.target.value)} />
          </label>
          <label className="checkbox-line">
            <input type="checkbox" checked={useServerProxy} onChange={(e) => setUseServerProxy(e.target.checked)} />
            Use server proxy
          </label>
          {endpoint ? (
            <div className="stack">
              <div><strong>Endpoint:</strong> <span className="inline-code">{endpoint.endpoint}</span></div>
              <div className="helper-text">Headers: {endpoint.headers ? JSON.stringify(endpoint.headers) : "none"}</div>
              {isOpenClawSurface ? (
                <div className="helper-text">
                  OpenClaw should use this direct endpoint so a local browser can follow the loopback control flow.
                  The Open button is hidden until the gateway health is live, then it opens the direct endpoint.
                </div>
              ) : null}
              {isOpenClawSurface ? (
                <div className="helper-text">
                  Gateway health: <strong>{openClawReady ? "live" : "starting"}</strong>
                </div>
              ) : null}
              {activePortPreset.embeddable === false ? (
                <div className="helper-text">
                  This surface blocks iframe embedding with X-Frame-Options/CSP. Use the separate tab for the real session.
                </div>
              ) : null}
              {isOpenClawSurface && !openClawReady ? (
                <div className="helper-text">
                  Embedded preview stays hidden until the OpenClaw gateway reports a healthy `/healthz`.
                </div>
              ) : null}
              {surfaceUrl && activePortPreset.kind !== "execd" && (!isOpenClawSurface || openClawReady) ? (
                <div className="page-actions">
                  <a className="button secondary" href={surfaceUrl} target="_blank" rel="noreferrer">
                    Open surface
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="helper-text">Resolve an endpoint for this port first.</div>
          )}
        </div>
      </section>

      {showEmbeddedSurface ? (
        <section className="embedded-surface">
          <h4>Embedded surface</h4>
          <p>
            Rendering <strong>{activePortPreset.label}</strong> with the browser-facing URL.
            {activePortPreset.embeddable === false
              ? " The app itself blocks iframe rendering, so this preview may show a blocked or broken frame."
              : ""}
          </p>
          <iframe className="embedded-frame" src={surfaceUrl} title={activePortPreset.label} />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header"><h3>Metadata</h3></div>
        {metadataEntries.length === 0 ? (
          <div className="helper-text">No metadata.</div>
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
        endpoint={execdEndpoint}
        endpointHeaders={execdEndpointHeaders}
        bootstrapCommand={template.bootstrapCommand}
      />
    </div>
  );
}
