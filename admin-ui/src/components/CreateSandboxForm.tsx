import type { FormEvent } from "react";
import { useState } from "react";

import type { CreateSandboxRequest } from "../types";

interface CreateSandboxFormProps {
  busy: boolean;
  onCreate: (request: CreateSandboxRequest) => Promise<void>;
}

function parseRecordInput(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
}

export function CreateSandboxForm({ busy, onCreate }: CreateSandboxFormProps) {
  const [image, setImage] = useState("python:3.11-slim");
  const [entrypoint, setEntrypoint] = useState("python -m http.server 8000");
  const [timeout, setTimeoutValue] = useState("3600");
  const [cpu, setCpu] = useState("500m");
  const [memory, setMemory] = useState("512Mi");
  const [envText, setEnvText] = useState("PYTHONUNBUFFERED=1");
  const [metadataText, setMetadataText] = useState("name=Sandbox Quản Trị");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const request: CreateSandboxRequest = {
      image: { uri: image.trim() },
      entrypoint: entrypoint
        .trim()
        .split(/\s+/)
        .filter(Boolean),
      resourceLimits: {
        cpu: cpu.trim(),
        memory: memory.trim(),
      },
      timeout: timeout.trim() ? Number(timeout.trim()) : null,
    };

    const env = parseRecordInput(envText);
    const metadata = parseRecordInput(metadataText);

    if (Object.keys(env).length > 0) {
      request.env = env;
    }
    if (Object.keys(metadata).length > 0) {
      request.metadata = metadata;
    }

    await onCreate(request);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Tạo Sandbox</h3>
      </div>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          Image URI
          <input className="text-input" value={image} onChange={(event) => setImage(event.target.value)} />
        </label>

        <label>
          Lệnh Khởi Động
          <input
            className="text-input"
            value={entrypoint}
            onChange={(event) => setEntrypoint(event.target.value)}
            placeholder="python -m http.server 8000"
          />
        </label>

        <div className="detail-grid">
          <label>
            Thời Gian Hết Hạn (giây)
            <input className="text-input" value={timeout} onChange={(event) => setTimeoutValue(event.target.value)} />
          </label>
          <label>
            CPU
            <input className="text-input" value={cpu} onChange={(event) => setCpu(event.target.value)} />
          </label>
        </div>

        <label>
          Memory
          <input className="text-input" value={memory} onChange={(event) => setMemory(event.target.value)} />
        </label>

        <label>
          Biến Môi Trường
          <textarea
            className="text-area"
            value={envText}
            onChange={(event) => setEnvText(event.target.value)}
            placeholder={"KEY=value"}
          />
        </label>

        <label>
          Metadata
          <textarea
            className="text-area"
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
            placeholder={"name=Sandbox\nteam=platform"}
          />
        </label>

        <div className="page-actions">
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Đang tạo..." : "Tạo sandbox"}
          </button>
        </div>
      </form>
    </section>
  );
}
