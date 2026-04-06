import { useState } from "react";
import { parseKeyValueText } from "../lib/format";
import type { CreateSandboxRequest } from "../types";

const initialState = {
  imageUri: "opensandbox/code-interpreter:v1.0.2",
  timeout: "3600",
  entrypoint: "/opt/opensandbox/code-interpreter.sh",
  cpu: "500m",
  memory: "512Mi",
  envText: "PYTHON_VERSION=3.11",
  metadataText: "project=demo",
};

export function CreateSandboxForm({
  onSubmit,
  busy,
}: {
  onSubmit: (payload: CreateSandboxRequest) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState(initialState);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  

  return (
    <form
      className="panel grid"
      onSubmit={async (event) => {
        event.preventDefault();
        const payload: CreateSandboxRequest = {
          image: { uri: form.imageUri.trim() },
          timeout: Number(form.timeout) || 3600,
          entrypoint: form.entrypoint
            .split(" ")
            .map((item) => item.trim())
            .filter(Boolean),
          resourceLimits: {
            cpu: form.cpu.trim(),
            memory: form.memory.trim(),
          },
          env: parseKeyValueText(form.envText),
          metadata: parseKeyValueText(form.metadataText),
        };
        await onSubmit(payload);
      }}
    >
      <div className="panel-header">
        <h3>Tạo sandbox mới</h3>
      </div>
      <label>
        Image URI
        <input className="text-input" value={form.imageUri} onChange={(e) => update("imageUri", e.target.value)} />
      </label>
      <div className="two-column">
        <label>
          Timeout (giây)
          <input className="text-input" value={form.timeout} onChange={(e) => update("timeout", e.target.value)} />
        </label>
        <label>
          Entrypoint
          <input className="text-input" value={form.entrypoint} onChange={(e) => update("entrypoint", e.target.value)} />
        </label>
      </div>
      <div className="two-column">
        <label>
          CPU limit
          <input className="text-input" value={form.cpu} onChange={(e) => update("cpu", e.target.value)} />
        </label>
        <label>
          Memory limit
          <input className="text-input" value={form.memory} onChange={(e) => update("memory", e.target.value)} />
        </label>
      </div>
      <label>
        Environment (mỗi dòng dạng KEY=VALUE)
        <textarea className="text-area" value={form.envText} onChange={(e) => update("envText", e.target.value)} />
      </label>
      <label>
        Metadata (mỗi dòng dạng KEY=VALUE)
        <textarea className="text-area" value={form.metadataText} onChange={(e) => update("metadataText", e.target.value)} />
      </label>
      <div>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Đang tạo..." : "Tạo sandbox"}
        </button>
      </div>
    </form>
  );
}
