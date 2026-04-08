import { useEffect, useMemo, useState } from "react";
import type { CommandStatus, MetricsSnapshot } from "../types";
import ChartRenderer from "./ChartRenderer";
import TableRenderer from "./TableRenderer";

type FileInfo = {
  path: string;
  size: number;
  modified_at?: string;
  created_at?: string;
  owner?: string;
  group?: string;
  mode?: number;
};

type Props = {
  endpoint: string;
  endpointHeaders?: Record<string, string>;
  bootstrapCommand?: string;
};

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function buildHeaders(endpointHeaders: Record<string, string>, optionsHeaders?: HeadersInit) {
  const headers = new Headers();
  headers.set("Accept", "application/json");

  for (const [key, value] of Object.entries(endpointHeaders)) {
    headers.set(key, value);
  }

  if (optionsHeaders) {
    const extra = new Headers(optionsHeaders);
    extra.forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

async function requestJsonOrText<T>(
  endpoint: string,
  path: string,
  endpointHeaders: Record<string, string>,
  options: RequestInit = {},
): Promise<T> {
  const headers = buildHeaders(endpointHeaders, options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${normalizeEndpoint(endpoint)}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
  }

  if (!text.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

async function requestBlob(
  endpoint: string,
  path: string,
  endpointHeaders: Record<string, string>,
) {
  const response = await fetch(`${normalizeEndpoint(endpoint)}${path}`, {
    headers: buildHeaders(endpointHeaders),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
  }

  return response.blob();
}

function parseExecutionStream(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>;
}

function extractEventText(raw: string, type: string) {
  return parseExecutionStream(raw)
    .filter((event) => event.type === type)
    .map((event) => String(event.text ?? ""))
    .join(type === "stderr" ? "\n" : "");
}

function extractInitId(raw: string) {
  return (
    parseExecutionStream(raw).find((event) => event.type === "init")?.text?.toString() ??
    ""
  );
}

function tryParseChart(output: string) {
  try {
    let parsed = JSON.parse(output);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || parsed.type !== "chart" || !parsed.chart) return null;
    return parsed;
  } catch {
    return null;
  }
}

function tryParseTable(output: string) {
  try {
    let parsed = JSON.parse(output);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (parsed?.type === "table" && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function tryParseImage(output: string) {
  try {
    let parsed = JSON.parse(output);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (parsed?.type === "image" && typeof parsed.path === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

function tryParseImageBase64(output: string) {
  try {
    const parsed = JSON.parse(output);
    if (parsed?.type === "image_base64" && parsed.mime && parsed.data) return parsed;
    return null;
  } catch {
    return null;
  }
}

const STD_LIBS = new Set([
  "os", "sys", "json", "csv", "math", "random", "re", "time", "datetime",
  "pathlib", "typing", "base64", "subprocess", "itertools", "collections",
  "functools", "statistics", "urllib", "http", "hashlib", "tempfile", "shutil",
  "glob", "string", "io",
]);

function extractPythonImports(code: string): string[] {
  const modules = new Set<string>();

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      for (const part of importMatch[1].split(",")) {
        const mod = part.trim().split(" as ")[0].trim().split(".")[0];
        if (mod) modules.add(mod);
      }
      continue;
    }

    const fromMatch = line.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import\s+/);
    if (fromMatch) {
      const mod = fromMatch[1].trim().split(".")[0];
      if (mod) modules.add(mod);
    }
  }

  return [...modules].filter((mod) => !STD_LIBS.has(mod));
}

function buildPythonCommand(code: string, autoInstallLibs = false) {
  const thirdPartyModules = extractPythonImports(code);
  const installer = autoInstallLibs && thirdPartyModules.length
    ? `
import subprocess
import sys

mods = ${JSON.stringify(thirdPartyModules)}
for mod in mods:
    try:
        __import__(mod)
    except Exception:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", mod])
        except Exception as e:
            print(f"[auto-install-failed] {mod}: {e}")
`
    : "";

  const wrappedCode = `
import json
${installer}
_globals = {}
_locals = {}
USER_CODE
result = _locals.get("result", None)

if result is not None:
    try:
        import pandas as pd
        if isinstance(result, pd.DataFrame):
            print(json.dumps({
                "type": "table",
                "columns": list(result.columns),
                "rows": result.fillna("").astype(str).to_dict(orient="records")
            }, ensure_ascii=False))
        elif isinstance(result, pd.Series):
            df = result.to_frame().reset_index()
            print(json.dumps({
                "type": "table",
                "columns": list(df.columns),
                "rows": df.fillna("").astype(str).to_dict(orient="records")
            }, ensure_ascii=False))
        else:
            print(result)
    except Exception:
        print(result)
`;

  const fullCode = wrappedCode.replace("USER_CODE", `exec(${JSON.stringify(code)}, _globals, _locals)`);
  const encoded = btoa(unescape(encodeURIComponent(fullCode)));
  return `python3 -c "import base64; exec(base64.b64decode('${encoded}').decode('utf-8'))"`;
}

export default function ExecutionPanel({ endpoint, endpointHeaders = {}, bootstrapCommand = "" }: Props) {
  const [mode, setMode] = useState<"python" | "command">("python");
  const [code, setCode] = useState('print("Hello from sandbox")');
  const [commandCwd, setCommandCwd] = useState("");
  const [commandTimeout, setCommandTimeout] = useState("60000");
  const [commandEnvText, setCommandEnvText] = useState("");
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [chartData, setChartData] = useState<any>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [autoInstallLibs, setAutoInstallLibs] = useState(true);

  const [backgroundCommandId, setBackgroundCommandId] = useState("");
  const [backgroundStatus, setBackgroundStatus] = useState<CommandStatus | null>(null);
  const [backgroundLogs, setBackgroundLogs] = useState("");
  const [backgroundCursor, setBackgroundCursor] = useState<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTargetPath, setUploadTargetPath] = useState("");
  const [searchPath, setSearchPath] = useState(".");
  const [searchPattern, setSearchPattern] = useState("*");
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [filePreviewPath, setFilePreviewPath] = useState("");
  const [filePreview, setFilePreview] = useState("");

  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!backgroundCommandId || !backgroundStatus?.running) return undefined;

    const timer = window.setInterval(() => {
      void pollBackgroundJob();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [backgroundCommandId, backgroundStatus?.running, backgroundCursor]);

  useEffect(() => {
    if (!endpoint) return undefined;

    void fetchMetrics();
    const timer = window.setInterval(() => {
      void fetchMetrics();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [endpoint]);

  const envs = useMemo(() => {
    const result: Record<string, string> = {};
    for (const rawLine of commandEnvText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) result[key] = value;
    }
    return result;
  }, [commandEnvText]);

  function ensureEndpoint() {
    if (!endpoint) {
      setOutput("Chưa resolve được endpoint. Hãy để port = 44772 và bật use_server_proxy=true.");
      return false;
    }
    return true;
  }

  function clearRichOutput() {
    setChartData(null);
    setTableData(null);
    setImageUrl(null);
    setImagePath(null);
  }

  async function loadImagePreview(path: string) {
    const blob = await requestBlob(
      endpoint,
      `/files/download?path=${encodeURIComponent(path)}`,
      endpointHeaders,
    );
    const url = URL.createObjectURL(blob);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(url);
    setImagePath(path);
  }

  async function execute(command: string) {
    const response = await requestJsonOrText<string>(
      endpoint,
      "/command",
      endpointHeaders,
      {
        method: "POST",
        body: JSON.stringify({
          command,
          cwd: commandCwd || undefined,
          timeout: commandTimeout ? Number(commandTimeout) : undefined,
          background: backgroundMode,
          envs: Object.keys(envs).length ? envs : undefined,
        }),
      },
    );

    return typeof response === "string" ? response : JSON.stringify(response);
  }

  async function handleExecution(rawText: string) {
    const stdoutText = extractEventText(rawText, "stdout");
    const stderrText = extractEventText(rawText, "stderr");
    const initId = extractInitId(rawText);

    if (backgroundMode && initId) {
      setBackgroundCommandId(initId);
      setBackgroundCursor(null);
      setBackgroundLogs("");
      setBackgroundStatus(null);
      await pollBackgroundJob(initId, true);
    }

    const chart = tryParseChart(stdoutText);
    const table = tryParseTable(stdoutText);
    const image = tryParseImage(stdoutText);
    const imageBase64 = tryParseImageBase64(stdoutText);

    if (chart) {
      setChartData(chart);
      setTableData(null);
      setOutput("");
      setImageUrl(null);
      setImagePath(null);
      return;
    }

    if (table) {
      setChartData(null);
      setTableData(table);
      setOutput("");
      setImageUrl(null);
      setImagePath(null);
      return;
    }

    if (imageBase64) {
      clearRichOutput();
      setImagePath("inline-image.png");
      setImageUrl(`data:${imageBase64.mime};base64,${imageBase64.data}`);
      setOutput("");
      return;
    }

    if (image) {
      clearRichOutput();
      setOutput(`Image created: ${image.path}`);
      await loadImagePreview(image.path);
      return;
    }

    clearRichOutput();
    setOutput(stdoutText || stderrText || rawText);
  }

  async function handleRun() {
    if (!ensureEndpoint()) return;

    setLoading(true);
    try {
      const command = mode === "python" ? buildPythonCommand(code, autoInstallLibs) : code;
      const rawText = await execute(command);
      await handleExecution(rawText);
    } catch (error) {
      clearRichOutput();
      setOutput(error instanceof Error ? error.message : "Unknown execution error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchBackgroundStatusById(commandId: string) {
    const response = await requestJsonOrText<CommandStatus>(
      endpoint,
      `/command/status/${commandId}`,
      endpointHeaders,
    );
    setBackgroundStatus(response);
  }

  async function fetchBackgroundLogsById(commandId: string, reset = false) {
    const cursor = reset ? null : backgroundCursor;
    const response = await fetch(
      `${normalizeEndpoint(endpoint)}/command/${commandId}/logs${cursor !== null ? `?cursor=${cursor}` : ""}`,
      {
        headers: buildHeaders(endpointHeaders),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
    }

    const nextCursorHeader = response.headers.get("EXECD-COMMANDS-TAIL-CURSOR");
    const nextCursor = nextCursorHeader ? Number(nextCursorHeader) : null;
    setBackgroundCursor(Number.isFinite(nextCursor) ? nextCursor : null);
    setBackgroundLogs((current) => (reset || cursor === null ? text : `${current}${text ? `\n${text}` : ""}`).trim());
  }

  async function pollBackgroundJob(commandId = backgroundCommandId, resetLogs = false) {
    if (!commandId) return;
    await Promise.all([
      fetchBackgroundStatusById(commandId),
      fetchBackgroundLogsById(commandId, resetLogs),
    ]);
  }

  async function uploadFile() {
    if (!selectedFile || !ensureEndpoint()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      const path = uploadTargetPath.trim() || `./${selectedFile.name}`;
      formData.append("metadata", new Blob([JSON.stringify({ path, mode: 644 })], { type: "application/json" }));
      formData.append("file", selectedFile, selectedFile.name);

      const response = await fetch(`${normalizeEndpoint(endpoint)}/files/upload`, {
        method: "POST",
        headers: buildHeaders(endpointHeaders),
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
      }

      setOutput(`Uploaded ${selectedFile.name} to ${path}`);
      setFilePreviewPath(path);
      await previewFile(path);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function previewFile(path = filePreviewPath) {
    if (!path || !ensureEndpoint()) return;
    try {
      const response = await fetch(
        `${normalizeEndpoint(endpoint)}/files/download?path=${encodeURIComponent(path)}`,
        { headers: buildHeaders(endpointHeaders) },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
      }

      const blob = await response.blob();
      if (blob.type.startsWith("image/")) {
        clearRichOutput();
        const url = URL.createObjectURL(blob);
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImageUrl(url);
        setImagePath(path);
        setFilePreview("");
        return;
      }

      const text = await blob.text();
      setFilePreview(text);
      setFilePreviewPath(path);
    } catch (error) {
      setFilePreview(error instanceof Error ? error.message : "Đọc file thất bại");
    }
  }

  async function searchFiles() {
    if (!ensureEndpoint()) return;
    try {
      const response = await requestJsonOrText<FileInfo[]>(
        endpoint,
        `/files/search?path=${encodeURIComponent(searchPath)}&pattern=${encodeURIComponent(searchPattern)}`,
        endpointHeaders,
      );
      setSearchResults(Array.isArray(response) ? response : []);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Search failed");
    }
  }

  async function fetchMetrics() {
    if (!endpoint) return;
    try {
      const response = await requestJsonOrText<MetricsSnapshot>(
        endpoint,
        "/metrics",
        endpointHeaders,
      );
      setMetrics(response);
    } catch {
      setMetrics(null);
    }
  }

  return (
    <div className="workbench-section">
      <div className="panel-header">
        <h3>Agent Workbench</h3>
      </div>

      <div className="workbench-grid">
        <div className="stack">
          <section className="command-card">
            <h4>Shell + Chạy Code</h4>
            <p>Endpoint: <span className="inline-code">{endpoint || "Chưa có endpoint"}</span></p>

            <div className="inline-list">
              <button className={mode === "python" ? "button" : "ghost-button"} onClick={() => setMode("python")} type="button">
                Python
              </button>
              <button className={mode === "command" ? "button" : "ghost-button"} onClick={() => setMode("command")} type="button">
                Command
              </button>
              {bootstrapCommand ? (
                <button
                  className="ghost-button"
                  onClick={() => {
                    setMode("command");
                    setCode(bootstrapCommand);
                    setBackgroundMode(true);
                  }}
                  type="button"
                >
                  Dùng lệnh khởi tạo
                </button>
              ) : null}
              <button
                className="ghost-button"
                onClick={() => {
                  clearRichOutput();
                  setOutput("");
                }}
                type="button"
              >
                Xóa output
              </button>
            </div>

            <div className="two-column">
              <label>
                Thư mục làm việc
                <input className="text-input" value={commandCwd} onChange={(e) => setCommandCwd(e.target.value)} placeholder="/workspace" />
              </label>
              <label>
                Timeout (ms)
                <input className="text-input" value={commandTimeout} onChange={(e) => setCommandTimeout(e.target.value)} />
              </label>
            </div>

            <label className="checkbox-line">
              <input type="checkbox" checked={backgroundMode} onChange={(e) => setBackgroundMode(e.target.checked)} />
              Chạy dưới dạng background job
            </label>

            {mode === "python" ? (
              <label className="checkbox-line">
                <input type="checkbox" checked={autoInstallLibs} onChange={(e) => setAutoInstallLibs(e.target.checked)} />
                Tự động cài thư viện Python
              </label>
            ) : null}

            <label>
              Ghi đè biến môi trường, mỗi dòng một `KEY=VALUE`
              <textarea className="text-area" value={commandEnvText} onChange={(e) => setCommandEnvText(e.target.value)} />
            </label>

            <label>
              {mode === "python" ? "Python code" : "Command"}
              <textarea className="text-area" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>

            <div className="page-actions">
              <button className="button" disabled={loading} onClick={handleRun} type="button">
                {loading ? "Đang chạy..." : "Chạy"}
              </button>
              {backgroundCommandId ? (
                <button className="ghost-button" onClick={() => void pollBackgroundJob(backgroundCommandId, true)} type="button">
                  Làm mới job
                </button>
              ) : null}
            </div>

            {backgroundCommandId ? (
              <div className="panel subtle-panel">
                <div className="helper-text">Background command id: <span className="inline-code">{backgroundCommandId}</span></div>
                <div className="helper-text">
                  Trạng thái: {backgroundStatus?.running ? "Running" : "Finished"}
                  {backgroundStatus?.exit_code !== undefined ? ` | exit=${backgroundStatus.exit_code}` : ""}
                </div>
                <pre className="terminal-output">{backgroundLogs || "Chưa có logs."}</pre>
              </div>
            ) : null}

            {chartData ? (
              <ChartRenderer data={chartData} />
            ) : tableData ? (
              <TableRenderer data={tableData} />
            ) : imageUrl ? (
              <div className="stack">
                <div className="helper-text">Image artifact: {imagePath}</div>
                <img src={imageUrl} alt="artifact" style={{ maxWidth: "100%", borderRadius: 14 }} />
                <a className="ghost-button" href={imageUrl} download={imagePath || "artifact.png"}>Tải ảnh xuống</a>
              </div>
            ) : (
              <pre className="terminal-output">{output || "Chưa có output."}</pre>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="files-panel">
            <h4>Files + Artifacts</h4>
            <div className="two-column">
              <label>
                Đường dẫn upload đích
                <input className="text-input" value={uploadTargetPath} onChange={(e) => setUploadTargetPath(e.target.value)} placeholder="./artifact.txt" />
              </label>
              <label>
                Chọn file
                <input className="text-input" type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="page-actions">
              <button className="button" type="button" disabled={!selectedFile || loading} onClick={uploadFile}>
                Upload file
              </button>
            </div>

            <div className="two-column">
              <label>
                Đường dẫn tìm kiếm
                <input className="text-input" value={searchPath} onChange={(e) => setSearchPath(e.target.value)} />
              </label>
              <label>
                Mẫu tìm kiếm
                <input className="text-input" value={searchPattern} onChange={(e) => setSearchPattern(e.target.value)} />
              </label>
            </div>
            <div className="page-actions">
              <button className="ghost-button" type="button" onClick={searchFiles}>
                Tìm file
              </button>
            </div>

            <label>
              Đường dẫn file cần xem
              <input className="text-input" value={filePreviewPath} onChange={(e) => setFilePreviewPath(e.target.value)} placeholder="/tmp/output.txt" />
            </label>
            <div className="page-actions">
              <button className="ghost-button" type="button" onClick={() => void previewFile()}>
                Đọc file
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Size</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.slice(0, 12).map((entry) => (
                      <tr key={entry.path}>
                        <td className="inline-code">{entry.path}</td>
                        <td>{entry.size}</td>
                        <td>
                          <button className="ghost-button" type="button" onClick={() => void previewFile(entry.path)}>
                            Xem trước
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {filePreview ? <pre className="terminal-output">{filePreview}</pre> : null}
          </section>

          <section className="metrics-card">
            <h4>Sandbox Metrics</h4>
            <div className="page-actions">
              <button className="ghost-button" type="button" onClick={() => void fetchMetrics()}>
                Làm mới metrics
              </button>
            </div>

            {metrics ? (
              <div className="metrics-grid">
                <div>
                  <div className="helper-text">CPU usage</div>
                  <div>{metrics.cpu_used_pct.toFixed(1)}%</div>
                  <div className="metric-bar"><span style={{ width: `${Math.min(metrics.cpu_used_pct, 100)}%` }} /></div>
                </div>
                <div>
                  <div className="helper-text">Memory usage</div>
                  <div>{metrics.mem_used_mib.toFixed(0)} / {metrics.mem_total_mib.toFixed(0)} MiB</div>
                  <div className="metric-bar"><span style={{ width: `${Math.min((metrics.mem_used_mib / metrics.mem_total_mib) * 100, 100)}%` }} /></div>
                </div>
                <div className="helper-text">CPU count: {metrics.cpu_count}</div>
              </div>
            ) : (
              <div className="helper-text">Chưa lấy được metrics.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
