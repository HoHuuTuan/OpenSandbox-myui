import { useEffect, useMemo, useState } from "react";
import { parseKeyValueText } from "../lib/format";
import { getTemplateById, sandboxTemplates } from "../lib/templates";
import type { CreateSandboxRequest } from "../types";

type FormState = {
  templateId: string;
  imageUri: string;
  timeout: string;
  entrypoint: string;
  cpu: string;
  memory: string;
  envText: string;
  metadataText: string;
};

function buildFormFromTemplate(templateId: string): FormState {
  const template = getTemplateById(templateId);
  return {
    templateId: template.id,
    imageUri: template.imageUri,
    timeout: template.timeout,
    entrypoint: template.entrypoint,
    cpu: template.cpu,
    memory: template.memory,
    envText: template.envText,
    metadataText: template.metadataText,
  };
}

export function CreateSandboxForm({
  onSubmit,
  busy,
  initialTemplateId,
}: {
  onSubmit: (payload: CreateSandboxRequest) => Promise<void>;
  busy: boolean;
  initialTemplateId?: string;
}) {
  const resolvedTemplateId = getTemplateById(initialTemplateId ?? "code-agent").id;
  const [form, setForm] = useState<FormState>(() => buildFormFromTemplate(resolvedTemplateId));

  useEffect(() => {
    setForm(buildFormFromTemplate(resolvedTemplateId));
  }, [resolvedTemplateId]);

  const selectedTemplate = useMemo(() => getTemplateById(form.templateId), [form.templateId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    setForm(buildFormFromTemplate(templateId));
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
          metadata: {
            ...parseKeyValueText(form.metadataText),
            template: form.templateId,
          },
        };
        await onSubmit(payload);
      }}
    >
      <div className="panel-header">
        <h3>Template Agent</h3>
      </div>

      <div className="template-grid">
        {sandboxTemplates.map((template) => (
          <button
            className="template-card"
            key={template.id}
            onClick={() => applyTemplate(template.id)}
            type="button"
          >
            <div className="template-chip">{template.category}</div>
            <h4>{template.name}</h4>
            <p>{template.description}</p>
            <div className="helper-text">Image: {template.imageUri}</div>
          </button>
        ))}
      </div>

      <div className="panel subtle-panel">
        <div className="panel-header">
          <h3>Template Đã Chọn</h3>
        </div>
        <div className="stack">
          <div className="helper-text">{selectedTemplate.description}</div>
          <div className="inline-list">
            {selectedTemplate.ports.map((port) => (
              <span className="pill" key={`${selectedTemplate.id}-${port.port}`}>
                {port.label}: {port.port}
              </span>
            ))}
          </div>
          {selectedTemplate.bootstrapCommand ? (
            <div className="caption">Lệnh khởi tạo: {selectedTemplate.bootstrapCommand}</div>
          ) : null}
          <div className="stack">
            {selectedTemplate.recipe.map((line) => (
              <div className="helper-text" key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-header">
        <h3>Cấu Hình Sandbox</h3>
      </div>

      <label>
        Mã template
        <input className="text-input" value={form.templateId} onChange={(e) => update("templateId", e.target.value)} />
      </label>

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
        Biến môi trường, mỗi dòng một `KEY=VALUE`
        <textarea className="text-area" value={form.envText} onChange={(e) => update("envText", e.target.value)} />
      </label>

      <label>
        Metadata, mỗi dòng một `KEY=VALUE`
        <textarea className="text-area" value={form.metadataText} onChange={(e) => update("metadataText", e.target.value)} />
      </label>

      <div>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Đang tạo..." : "Tạo sandbox workbench"}
        </button>
      </div>
    </form>
  );
}
