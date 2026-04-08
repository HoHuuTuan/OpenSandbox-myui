import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreateSandboxForm } from "../components/CreateSandboxForm";
import { PageHeader } from "../components/PageHeader";
import { getTemplateById } from "../lib/templates";
import { useSandboxCollection } from "./hooks";

export function SandboxCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [actionError, setActionError] = useState("");
  const initialTemplateId = getTemplateById(searchParams.get("template") ?? "code-agent").id;

  const { create, busy } = useSandboxCollection({
    state: "",
    metadata: "",
    pageSize: 50,
  });

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Create"
        title="Tạo sandbox mới"
        subtitle="Chọn template phù hợp với agent, browser hoặc desktop workload rồi tinh chỉnh lại image, env và entrypoint."
        actions={
          <button className="button secondary" onClick={() => navigate("/lab")}>
            Về Agent Lab
          </button>
        }
      />

      {actionError ? <div className="error-banner">{actionError}</div> : null}

      <CreateSandboxForm
        busy={busy}
        initialTemplateId={initialTemplateId}
        onSubmit={async (payload) => {
          setActionError("");
          try {
            const created = await create(payload);
            navigate(`/sandboxes/${created.id}`);
          } catch (error) {
            setActionError(
              error instanceof Error ? error.message : "Tạo sandbox thất bại."
            );
          }
        }}
      />
    </div>
  );
}
