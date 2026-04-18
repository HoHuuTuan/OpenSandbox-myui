import { useEffect, useMemo, useState } from "react";
import { parseKeyValueText, parseNetworkPolicyText } from "../lib/format";
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
  networkPolicyText: string;
};

function parseCommandLine(value: string) {
  const tokens: string[] = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|[^\s]+/g;

  for (const match of value.matchAll(pattern)) {
    const token = match[1] ?? match[2] ?? match[0];
    const normalized = token.replace(/\\(["'\\])/g, "$1").trim();
    if (normalized) {
      tokens.push(normalized);
    }
  }

  return tokens;
}

function compactRecord(entries: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value.trim() !== ""),
  );
}

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
    networkPolicyText: template.networkPolicyText ?? "",
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
        const entrypoint = parseCommandLine(form.entrypoint.trim());
        const payload: CreateSandboxRequest = {
          image: { uri: form.imageUri.trim() },
          timeout: Number(form.timeout) || 3600,
          resourceLimits: compactRecord({
            cpu: form.cpu.trim(),
            memory: form.memory.trim(),
          }),
          env: parseKeyValueText(form.envText),
          metadata: {
            ...parseKeyValueText(form.metadataText),
            template: form.templateId,
          },
        };
        const networkPolicy = parseNetworkPolicyText(form.networkPolicyText);
        if (networkPolicy) {
          payload.networkPolicy = networkPolicy;
        }
        if (entrypoint.length > 0) {
          payload.entrypoint = entrypoint;
        }
        await onSubmit(payload);
      }}
    >
      <div className="panel-header">
        <h3>Agent Templates</h3>
      </div>

      <div className="template-grid">
        {sandboxTemplates.map((template) => (
          <button
            className="template-card"
            key={template.id}
            onClick={() => applyTemplate(template.id)}
            type="button"
            aria-pressed={form.templateId === template.id}
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
          <h3>Selected Template</h3>
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
            <div className="caption">Bootstrap command: {selectedTemplate.bootstrapCommand}</div>
          ) : null}
          <div className="stack">
            {selectedTemplate.recipe.map((line) => (
              <div className="helper-text" key={line}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-header">
        <h3>Sandbox Config</h3>
      </div>

      <label>
        Template id
        <input
          className="text-input"
          value={form.templateId}
          onChange={(event) => update("templateId", event.target.value)}
        />
      </label>

      <label>
        Image URI
        <input
          className="text-input"
          value={form.imageUri}
          onChange={(event) => update("imageUri", event.target.value)}
        />
      </label>

      <div className="two-column">
        <label>
          Timeout (seconds)
          <input
            className="text-input"
            value={form.timeout}
            onChange={(event) => update("timeout", event.target.value)}
          />
        </label>
        <label>
          Entrypoint
          <input
            className="text-input"
            value={form.entrypoint}
            onChange={(event) => update("entrypoint", event.target.value)}
          />
        </label>
      </div>

      <div className="two-column">
        <label>
          CPU limit
          <input
            className="text-input"
            value={form.cpu}
            onChange={(event) => update("cpu", event.target.value)}
          />
        </label>
        <label>
          Memory limit
          <input
            className="text-input"
            value={form.memory}
            onChange={(event) => update("memory", event.target.value)}
          />
        </label>
      </div>

      <label>
        Environment variables, one `KEY=VALUE` per line
        <textarea
          className="text-area"
          value={form.envText}
          onChange={(event) => update("envText", event.target.value)}
        />
      </label>

      <label>
        Metadata, one `KEY=VALUE` per line
        <textarea
          className="text-area"
          value={form.metadataText}
          onChange={(event) => update("metadataText", event.target.value)}
        />
      </label>

      <label>
        Network policy, one `default=deny|allow` or `allow=target` / `deny=target` per line
        <textarea
          className="text-area"
          value={form.networkPolicyText}
          onChange={(event) => update("networkPolicyText", event.target.value)}
        />
      </label>

      <div>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create sandbox workbench"}
        </button>
      </div>
    </form>
  );
}
