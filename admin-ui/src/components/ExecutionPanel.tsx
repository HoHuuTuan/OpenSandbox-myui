import { useState, useEffect } from "react";
import ChartRenderer from "./ChartRenderer";
import TableRenderer from "./TableRenderer";


type ExecResult = {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  [key: string]: unknown;
};

type Props = {
  endpoint: string;
  endpointHeaders?: Record<string, string>;
};

function normalizeEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

async function execRequest<T>(
  endpoint: string,
  path: string,
  endpointHeaders: Record<string, string> = {},
  options: RequestInit = {},
): Promise<T> {
  const url = `${normalizeEndpoint(endpoint)}${path}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");

  for (const [key, value] of Object.entries(endpointHeaders)) {
    headers.set(key, value);
  }

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.headers) {
    const extra = new Headers(options.headers);
    extra.forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`);
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

async function fetchImageBlob(
  endpoint: string,
  filePath: string,
  endpointHeaders: Record<string, string> = {},
): Promise<Blob> {
  const url = `${normalizeEndpoint(endpoint)}/files/${encodeURIComponent(filePath)}`;

  const headers = new Headers();
  Object.entries(endpointHeaders).forEach(([k, v]) => headers.set(k, v));

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }

  return await res.blob();
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

  const fullCode = wrappedCode.replace(
    "USER_CODE",
    `exec(${JSON.stringify(code)}, _globals, _locals)`
  );

  const encoded = btoa(unescape(encodeURIComponent(fullCode)));

  return `python3 -c "import base64; exec(base64.b64decode('${encoded}').decode('utf-8'))"`;
};

function formatOutput(res: unknown) {
  if (typeof res === "string") return res;

  const obj = res as ExecResult | null;
  if (!obj) return "null";

  return [
    `stdout: ${obj.stdout ?? ""}`,
    `stderr: ${obj.stderr ?? ""}`,
    `exit_code: ${String(obj.exit_code ?? "")}`,
    `raw: ${JSON.stringify(obj, null, 2)}`,
  ].join("\n");
}

function parseExecutionStream(raw: string) {
  const events: any[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // bỏ qua dòng không parse được
    }
  }

  return events;
}

function extractStdoutFromExecution(raw: string) {
  const events = parseExecutionStream(raw);

  return events
    .filter((event) => event?.type === "stdout")
    .map((event) => event?.text ?? "")
    .join("");
}

function extractStderrFromExecution(raw: string) {
  const events = parseExecutionStream(raw);

  return events
    .filter((event) => event?.type === "stderr")
    .map((event) => event?.text ?? "")
    .join("\n");
}

function tryParseChart(output: string) {
  try {
    let parsed = JSON.parse(output);

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (!parsed || parsed.type !== "chart" || !parsed.chart) {
      return null;
    }

    if (parsed.chart === "pie" && Array.isArray(parsed.series)) {
      return parsed;
    }

    if (
      (parsed.chart === "line" || parsed.chart === "bar") &&
      Array.isArray(parsed.x) &&
      Array.isArray(parsed.series)
    ) {
      return parsed;
    }
  } catch {}

  return null;
};

function tryParseTable(output: string) {
  try {
    let parsed = JSON.parse(output);

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (
      parsed &&
      parsed.type === "table" &&
      Array.isArray(parsed.columns) &&
      Array.isArray(parsed.rows)
    ) {
      return parsed;
    }
  } catch {}

  return null;
};

function tryParseImage(output: string) {
  try {
    let parsed = JSON.parse(output);

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (
      parsed &&
      parsed.type === "image" &&
      typeof parsed.path === "string"
    ) {
      return parsed;
    }
  } catch {}

  return null;
}

function tryParseImageBase64(output: string) {
  try {
    let parsed = JSON.parse(output);

    if (
      parsed &&
      parsed.type === "image_base64" &&
      typeof parsed.mime === "string" &&
      typeof parsed.data === "string"
    ) {
      return parsed as {
        type: "image_base64";
        mime: string;
        data: string;
      };
    }
  } catch {}

  return null;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Không đọc được file"));
        return;
      }

      const base64 = result.split(",")[1];
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Đọc file thất bại"));
    reader.readAsDataURL(file);
  });
};

function escapePythonString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
};

const STD_LIBS = new Set([
  "os", "sys", "json", "csv", "math", "random", "re", "time", "datetime",
  "pathlib", "typing", "base64", "subprocess", "itertools", "collections",
  "functools", "statistics", "urllib", "http", "hashlib", "tempfile", "shutil",
  "glob", "string", "io"
]);

function extractPythonImports(code: string): string[] {
  const modules = new Set<string>();

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      const parts = importMatch[1].split(",");
      for (const part of parts) {
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
};

export default function ExecutionPanel({ endpoint, endpointHeaders = {} }: Props) {
  const [mode, setMode] = useState<"python" | "command">("python");
  const [code, setCode] = useState('print("Hello from sandbox")');
  const [output, setOutput] = useState("");
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [autoInstallLibs, setAutoInstallLibs] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);


  const loadImagePreview = async (path: string) => {
    try {
      const blob = await fetchImageBlob(endpoint, path, endpointHeaders);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setImagePath(path);
    } catch (e: any) {
      setOutput("Error load image: " + (e?.message || "Unknown"));
    }
  };

  const ensureEndpoint = () => {
    if (!endpoint) {
      setOutput("Chưa resolve được endpoint. Hãy để port = 44772 và bật use_server_proxy=true.");
      return false;
    }
    return true;
  };

  const handleRunCode = async () => {
    if (!ensureEndpoint()) return;

    setLoading(true);
    try {
      const command = buildPythonCommand(code, autoInstallLibs);
      const res = await execRequest<unknown>(
        endpoint,
        "/command",
        endpointHeaders,
        {
          method: "POST",
          body: JSON.stringify({ command }),
        },
      );

      const rawText = typeof res === "string" ? res : formatOutput(res);
      const stdoutText = extractStdoutFromExecution(rawText);
      const stderrText = extractStderrFromExecution(rawText);

      const chart = tryParseChart(stdoutText);
      const image = tryParseImage(stdoutText);
      const imageBase64 = tryParseImageBase64(stdoutText);
      const table = tryParseTable(stdoutText);
      

      if (chart) {
        setChartData(chart);
        setTableData(null);
        setImageUrl(null);
        setImagePath(null);
        setOutput("");
      } else if (table) {
        setChartData(null);
        setTableData(table);
        setImageUrl(null);
        setImagePath(null);
        setOutput("");
      } else if (imageBase64) {
        setChartData(null);
        setTableData(null);
        setImagePath("inline-image.png");
        setImageUrl(`data:${imageBase64.mime};base64,${imageBase64.data}`);
        setOutput("");
      } else if (image) {
        setChartData(null);
        setTableData(null);
        setOutput(`Image created: ${image.path}`);
        await loadImagePreview(image.path);
      } else {
        setChartData(null);
        setTableData(null);
        setImageUrl(null);
        setImagePath(null);
        setOutput(stdoutText || stderrText || rawText);
      }
    } catch (e: any) {
      setOutput("Error: " + (e?.message || "Unknown error"));
      setChartData(null);
      setImageUrl(null);
      setImagePath(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCommand = async () => {
    if (!ensureEndpoint()) return;

    setLoading(true);
    try {
      const res = await execRequest<unknown>(
        endpoint,
        "/command",
        endpointHeaders,
        {
          method: "POST",
          body: JSON.stringify({ command: code }),
        },
      );
      const rawText = typeof res === "string" ? res : formatOutput(res);
      const stdoutText = extractStdoutFromExecution(rawText);
      const stderrText = extractStderrFromExecution(rawText);

      setChartData(null);
      setTableData(null);
      setImageUrl(null);
      setImagePath(null);
      setOutput(stdoutText || stderrText || rawText);
    } catch (e: any) {
      setOutput("Error: " + (e?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

const handleSendFileToSandbox = async () => {
  if (!selectedFile) {
    setOutput("Chưa chọn file.");
    return;
  }

  if (!ensureEndpoint()) return;

  setLoading(true);
  try {
    const base64Data = await readFileAsBase64(selectedFile);
    const safeName = escapePythonString(selectedFile.name);

    const pythonCode = `
import base64

data = "${base64Data}"
filename = '${safeName}'

with open(filename, "wb") as f:
    f.write(base64.b64decode(data))

print(f"uploaded:{filename}")
`.trim();

    const command = buildPythonCommand(pythonCode);

    const res = await execRequest<unknown>(
      endpoint,
      "/command",
      endpointHeaders,
      {
        method: "POST",
        body: JSON.stringify({ command }),
      },
    );

    const rawText = typeof res === "string" ? res : formatOutput(res);
    const stdoutText = extractStdoutFromExecution(rawText);
    const stderrText = extractStderrFromExecution(rawText);

    setOutput(stdoutText || stderrText || rawText);
  } catch (e: any) {
    setOutput("Error: " + (e?.message || "Unknown error"));
  } finally {
    setLoading(false);
  }
};

const handleGenerateCode = async () => {
  if (!aiPrompt.trim()) {
    setOutput("Hãy nhập yêu cầu cho AI.");
    return;
  }

  setAiLoading(true);

  try {
    const res = await fetch("http://localhost:3001/generate-python", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: aiPrompt }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Generate code failed");
    }

    const generatedCode = data.code || "";

    setCode(generatedCode);

    const command = buildPythonCommand(generatedCode, autoInstallLibs);

    const execRes = await execRequest<any>(
      endpoint,
      "/command",
      endpointHeaders,
      {
        method: "POST",
        body: JSON.stringify({ command }),
      }
    );

    const rawText =
      typeof execRes === "string"
        ? execRes
        : formatOutput(execRes);

    const stdoutText = extractStdoutFromExecution(rawText);
    const stderrText = extractStderrFromExecution(rawText);

    const chart = tryParseChart(stdoutText);
    const table = tryParseTable(stdoutText);
    const image = tryParseImage(stdoutText);
    const imageBase64 = tryParseImageBase64(stdoutText);

    if (chart) {
      setChartData(chart);
      setTableData(null);
      setImageUrl(null);
      setOutput("");
    } else if (table) {
      setChartData(null);
      setTableData(table);
      setImageUrl(null);
      setOutput("");
    } else if (imageBase64) {
      setChartData(null);
      setTableData(null);
      setImageUrl(`data:${imageBase64.mime};base64,${imageBase64.data}`);
      setOutput("");
    } else if (image) {
      await loadImagePreview(image.path);
    } else {
      setOutput(stdoutText || stderrText || rawText);
    }

  } catch (e: any) {
    setOutput("Error AI: " + (e?.message || "Unknown error"));
  } finally {
    setAiLoading(false);
  }
};

  
  return (
    <div style={{ marginTop: 20 }}>
      <h3>🚀 Run Code / Command</h3>

      <div style={{ marginBottom: 10, fontSize: 14 }}>
        <strong>Endpoint:</strong> {endpoint || "Chưa có"}
      </div>

      <div style={{ marginBottom: 10 }}>
        <button
          onClick={() => setMode("python")}
          disabled={loading}
          style={{ background: mode === "python" ? "#444" : "" }}
        >
          🐍 Python
        </button>

        <button
          onClick={() => setMode("command")}
          disabled={loading}
          style={{ marginLeft: 8, background: mode === "command" ? "#444" : "" }}
        >
          💻 Command
        </button>

        <button
          onClick={() => {
            setOutput("");
            setChartData(null);
            setTableData(null); 
            setImageUrl(null);
            setImagePath(null);
          }}
          disabled={loading}
          style={{ marginLeft: 8 }}
        >
          🧹 Clear
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={autoInstallLibs}
          onChange={(e) => setAutoInstallLibs(e.target.checked)}
          disabled={loading}
          style={{ marginRight: 8 }}
        />
        Auto install Python libraries
      </label>

      <div style={{ marginTop: 12 }}>
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button
          style={{ marginLeft: 8 }}
          disabled={!selectedFile || loading}
          onClick={handleSendFileToSandbox}
        >
          Send File To Sandbox
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ width: "100%", height: 140 }}
      />

      <div style={{ marginTop: 10 }}>
        <button
          onClick={mode === "python" ? handleRunCode : handleRunCommand}
          disabled={loading}
        >
          ▶ Run
        </button>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <div style={{ marginBottom: 6, fontWeight: "bold" }}>
          AI generate Python
        </div>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Ví dụ: vẽ biểu đồ doanh thu A=100, B=150, C=90"
          style={{ width: "100%", height: 80 }}
        />

        <div style={{ marginTop: 8 }}>
          <button onClick={handleGenerateCode} disabled={aiLoading || loading}>
            ✨ Generate Run
          </button>

          <button
            onClick={async () => {
              const res = await fetch("http://localhost:3001/generate-python");
              const data = await res.json();
              setCode(data.code);
            }}
          >
            Generate Only
          </button>
        </div>
      </div>

      {chartData ? (
        <ChartRenderer data={chartData} />
      ) : tableData ? (
        <TableRenderer data={tableData} />
      ) : imageUrl ? (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Image:</strong> {imagePath}
          </div>

          <img
            src={imageUrl}
            alt="sandbox"
            style={{
              maxWidth: "100%",
              minWidth: 200,
              minHeight: 120,
              objectFit: "contain",
              border: "1px solid #333",
              borderRadius: 8,
              background: "#fff",
              padding: 8,
            }}
          />

          <div style={{ marginTop: 8 }}>
            <a href={imageUrl} download={imagePath || "image.png"}>
              Download
            </a>
          </div>
        </div>
      ) : (
        <pre
          style={{
            marginTop: 20,
            background: "#111",
            color: "#0f0",
            padding: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}