import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageHeader } from "../components/PageHeader";
import { TerminalPane } from "../components/TerminalPane";
import { useSandboxDiagnostics } from "./hooks";

export function TerminalPage() {
  const { sandboxId = "" } = useParams();
  const { diagnostics, loading, error, refresh } = useSandboxDiagnostics(sandboxId);

  if (loading) {
    return <LoadingBlock label="Đang tải chẩn đoán..." />;
  }

  if (error || !diagnostics) {
    return <EmptyState title="Không tải được chẩn đoán" body={error || "Không có đầu ra."} />;
  }

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

      <TerminalPane title="Tổng Hợp" content={diagnostics.summary} />
      <TerminalPane title="Nhật Ký" content={diagnostics.logs} />
    </div>
  );
}
