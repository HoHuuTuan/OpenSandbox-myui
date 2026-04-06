import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateSandboxForm } from "../components/CreateSandboxForm";
import { PageHeader } from "../components/PageHeader";
import { useSandboxCollection } from "./hooks";

export function SandboxCreatePage() {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState("");

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
        subtitle="Nhập thông tin sandbox rồi bấm tạo."
        actions={
          <button className="button secondary" onClick={() => navigate("/sandboxes")}>
            Quay lại
          </button>
        }
      />

      {actionError ? <div className="error-banner">{actionError}</div> : null}

      <CreateSandboxForm
        busy={busy}
        onSubmit={async (payload) => {
          setActionError("");
          try {
            await create(payload);
            navigate("/sandboxes");
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