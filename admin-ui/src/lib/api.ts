import type {
  AdminSettings,
  CreateSandboxRequest,
  EndpointResponse,
  RenewExpirationRequest,
  Sandbox,
} from "../types";

type ApiSettings = any;

type ExecResult = {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
};

interface RequestOptions extends RequestInit {
  allowEmptyJson?: boolean;
}

function normalizeBaseUrl(baseUrl: string) {
   return (baseUrl ?? "").trim().replace(/\/$/, "");
}

async function parseJsonSafely(response: Response, allowEmptyJson = false) {
  const text = await response.text();
  if (!text.trim()) {
    if (allowEmptyJson) return null;
    throw new Error(`API trả về body rỗng cho ${response.url}.`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Response từ ${response.url} không phải JSON hợp lệ.`);
  }
}

async function request<T>(settings: AdminSettings, path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if ((settings?.apiKey ?? "").trim()) {
    headers.set("OPEN-SANDBOX-API-KEY", settings.apiKey.trim());
  }

  const response = await fetch(`${normalizeBaseUrl(settings?.apiBaseUrl ?? "")}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ""}`,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await parseJsonSafely(response, options.allowEmptyJson)) as T;
}

export async function fetchSandboxes(
  settings: AdminSettings,
  params?: { state?: string; metadata?: string; page?: number; pageSize?: number },
): Promise<Sandbox[]> {
  const search = new URLSearchParams();

  if (params?.state) search.append("state", params.state);
  if (params?.metadata) search.append("metadata", params.metadata);
  if (params?.page) search.append("page", String(params.page));
  if (params?.pageSize) search.append("pageSize", String(params.pageSize));

  const query = search.toString();

  const res = await request<any>(
    settings,
    `/sandboxes${query ? `?${query}` : ""}`
  );

  console.log("[fetchSandboxes RAW]", res);

  // 🔥 normalize tại đây luôn
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.sandboxes)) return res.sandboxes;

  return [];
}

export function fetchSandbox(settings: AdminSettings, sandboxId: string) {
  return request<Sandbox>(settings, `/sandboxes/${sandboxId}`);
}

export function createSandbox(settings: AdminSettings, payload: CreateSandboxRequest) {
  return request<Sandbox>(settings, "/sandboxes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pauseSandbox(settings: AdminSettings, sandboxId: string) {
  return request(settings, `/sandboxes/${sandboxId}/pause`, {
    method: "POST",
    allowEmptyJson: true,
  });
}

export function resumeSandbox(settings: AdminSettings, sandboxId: string) {
  return request(settings, `/sandboxes/${sandboxId}/resume`, {
    method: "POST",
    allowEmptyJson: true,
  });
}

export function deleteSandbox(settings: AdminSettings, sandboxId: string) {
  return request(settings, `/sandboxes/${sandboxId}`, {
    method: "DELETE",
    allowEmptyJson: true,
  });
}

export function renewSandboxExpiration(
  settings: AdminSettings,
  sandboxId: string,
  payload: RenewExpirationRequest,
) {
  return request<{ expiresAt: string }>(settings, `/sandboxes/${sandboxId}/renew-expiration`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSandboxEndpoint(
  settings: AdminSettings,
  sandboxId: string,
  port: string,
  useServerProxy: boolean,
) {
  const query = useServerProxy ? "?use_server_proxy=true" : "";
  return request<EndpointResponse>(settings, `/sandboxes/${sandboxId}/endpoints/${port}${query}`);
}

export function proxyPing(settings: any, sandboxId: string, port = "44772") {
  return request(settings, `/sandboxes/${sandboxId}/proxy/${port}/ping`);
}

export async function runCommand(
  settings: ApiSettings,
  sandboxId: string,
  command: string,
  port = "44772"
): Promise<ExecResult> {
  return request(settings, `/sandboxes/${sandboxId}/proxy/${port}/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      command,
    }),
  });
}

export async function runCode(
  settings: ApiSettings,
  sandboxId: string,
  code: string,
  port = "44772"
): Promise<ExecResult> {
  return request(settings, `/sandboxes/${sandboxId}/proxy/${port}/code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
}