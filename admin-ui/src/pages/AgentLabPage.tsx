import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { formatRelativeFromNow } from "../lib/format";
import { sandboxTemplates } from "../lib/templates";
import { useSandboxCollection } from "./hooks";

const categoryLabel = {
  agent: "Coding Agents",
  browser: "Browser Agents",
  desktop: "Desktop Surfaces",
  custom: "Tùy chỉnh",
} as const;

export function AgentLabPage() {
  const { items, error, refresh } = useSandboxCollection({ state: "", metadata: "", pageSize: 100 });

  const running = items.filter((item) => item.status.state === "Running");
  const activeTemplates = new Set(
    items
      .map((item) => String(item.metadata?.template ?? ""))
      .filter(Boolean),
  );

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Agent Lab"
        title="Test Agent Trên OpenSandbox"
        subtitle="Một cockpit để tạo sandbox theo template, chạy agent, mở browser/desktop surfaces và theo dõi output trong cùng một chỗ."
        actions={
          <>
            <Link className="ghost-button" to="/sandboxes">
              Xem danh sách
            </Link>
            <Link className="button" to="/sandboxes/new">
              Tạo sandbox mới
            </Link>
            <button className="ghost-button" onClick={refresh}>
              Làm mới
            </button>
          </>
        }
      />

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="hero-panel">
        <div>
          <span className="eyebrow">OpenSandbox Surfaces</span>
          <h3>Lifecycle + execd + browser ports</h3>
          <p className="page-subtitle">
            UI mới tập trung vào luồng thật của agent: tạo sandbox, cài tooling trong sandbox,
            chạy foreground/background jobs, đọc file/artifacts và mở các port như noVNC, VS Code, DevTools.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button" to="/sandboxes/new">
            Chọn template
          </Link>
          <Link className="ghost-button" to="/settings">
            Cấu hình API
          </Link>
        </div>
      </section>

      <div className="grid stats-grid">
        <StatCard title="Sandbox đang chạy" value={running.length} helper="Sẵn sàng để attach agent hoặc mở surface" />
        <StatCard title="Tổng sandbox" value={items.length} helper="Tất cả workload trong môi trường hiện tại" />
        <StatCard title="Template đang dùng" value={activeTemplates.size} helper="Số profile agent/browser/desktop đang hoạt động" />
        <StatCard
          title="Sandbox mới nhất"
          value={items[0]?.id.slice(0, 8) ?? "-"}
          helper={items[0] ? formatRelativeFromNow(items[0].createdAt) : "Chưa có sandbox"}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Templates</h3>
          <Link className="ghost-button" to="/sandboxes/new">
            Mở form tạo mới
          </Link>
        </div>
        <div className="template-grid">
          {sandboxTemplates.map((template) => (
            <article className="template-card" key={template.id}>
              <div className="template-chip">{categoryLabel[template.category]}</div>
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <div className="helper-text">Image: {template.imageUri}</div>
              <div className="helper-text">Ports: {template.ports.map((port) => port.port).join(", ")}</div>
              <div className="template-actions">
                <Link className="button secondary" to={`/sandboxes/new?template=${template.id}`}>
                  Dùng template
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Runbook</h3>
        </div>
        <div className="runbook-grid">
          <div className="subtle-panel panel">
            <h4>1. Tạo sandbox theo use case</h4>
            <p>Code agent dùng code-interpreter, browser agent dùng playwright hoặc chrome, GUI dùng desktop hoặc vscode.</p>
          </div>
          <div className="subtle-panel panel">
            <h4>2. Resolve đúng port</h4>
            <p>Giữ use_server_proxy=true để mở được HTTP, SSE, WebSocket và toàn bộ app chạy trong sandbox qua cùng một proxy surface.</p>
          </div>
          <div className="subtle-panel panel">
            <h4>3. Quan sát output và artifacts</h4>
            <p>Dùng background jobs, logs polling, file explorer và embedded surfaces để xem agent thật sự đã làm gì.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Sandbox đang hoạt động</h3>
          <Link className="ghost-button" to="/sandboxes">
            Tất cả sandbox
          </Link>
        </div>
        {running.length === 0 ? (
          <EmptyState
            title="Chưa có sandbox Running"
            description="Tạo một sandbox theo template để bắt đầu test agent, browser automation hoặc desktop surface."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Template</th>
                  <th>Image</th>
                  <th>State</th>
                  <th>Tạo lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {running.slice(0, 8).map((sandbox) => (
                  <tr key={sandbox.id}>
                    <td className="inline-code">{sandbox.id}</td>
                    <td>{String(sandbox.metadata?.template ?? "custom")}</td>
                    <td>{sandbox.image?.uri ?? "-"}</td>
                    <td>{sandbox.status.state}</td>
                    <td>{formatRelativeFromNow(sandbox.createdAt)}</td>
                    <td>
                      <Link className="ghost-button" to={`/sandboxes/${sandbox.id}`}>
                        Mở workbench
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
