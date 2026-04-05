import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { TerminalPane } from "../components/TerminalPane";
import { useSandboxDiagnostics } from "./hooks";

type TabKey = "summary" | "logs" | "inspect" | "events";

export function TerminalPage() {
  const { sandboxId = "" } = useParams();
  const { diagnostics, loading, error, refresh } = useSandboxDiagnostics(sandboxId);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  if (loading) {
    return <LoadingBlock label="Đang tải chẩn đoán..." />;
  }

  if (error || !diagnostics) {
    return <EmptyState title="Không tải được chẩn đoán" body={error || "Không có đầu ra."} />;
  }

  const tabContent = diagnostics[activeTab];

  return (
    <div className="grid">
      <PageHeader
        title="Nhật Ký Và Terminal"
        subtitle={`Thông tin chẩn đoán cho sandbox ${sandboxId} từ các endpoint DevOps đang có.`}
        actions={
          <div className="page-actions">
            <button className="button" onClick={refresh}>
              Làm mới
            </button>
            <Link className="ghost-button" to={`/sandboxes/${sandboxId}`}>
              Về chi tiết
            </Link>
          </div>
        }
      />

      <div className="card">
        <div className="page-actions">
          <button className={activeTab === "summary" ? "button" : "ghost-button"} onClick={() => setActiveTab("summary")}>
            Summary
          </button>
          <button className={activeTab === "logs" ? "button" : "ghost-button"} onClick={() => setActiveTab("logs")}>
            Logs
          </button>
          <button className={activeTab === "inspect" ? "button" : "ghost-button"} onClick={() => setActiveTab("inspect")}>
            Inspect
          </button>
          <button className={activeTab === "events" ? "button" : "ghost-button"} onClick={() => setActiveTab("events")}>
            Events
          </button>
        </div>
      </div>

      <TerminalPane title={activeTab.toUpperCase()} content={tabContent} />
    </div>
  );
}