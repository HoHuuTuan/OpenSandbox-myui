import type {
  AdminSettings,
  CreateSandboxRequest,
  EndpointResponse,
  ListSandboxesResponse,
  RenewExpirationRequest,
  Sandbox,
} from "../types";
import { getApiBaseUrlCandidates, saveSettings } from "./storage";

type ApiSettings = AdminSettings;
type ExecResult = {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
};

type SandboxListPayload = Sandbox[] | ListSandboxesResponse | { sandboxes?: Sandbox[] };

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
    throw new Error(`API returned an empty response body for ${response.url}.`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Response from ${response.url} is not valid JSON.`);
  }
}

async function request<T>(settings: AdminSettings, path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if ((settings.apiKey ?? "").trim()) {
    headers.set("OPEN-SANDBOX-API-KEY", settings.apiKey.trim());
  }

  const originalBaseUrl = normalizeBaseUrl(settings.apiBaseUrl ?? "");
  const candidateBaseUrls = getApiBaseUrlCandidates(originalBaseUrl);
  let response: Response | null = null;
  let lastNetworkError: unknown = null;
  let resolvedBaseUrl = originalBaseUrl;

  for (const baseUrl of candidateBaseUrls) {
    try {
      response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
        ...options,
        headers,
      });
      resolvedBaseUrl = normalizeBaseUrl(baseUrl);
      break;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!response) {
    throw lastNetworkError instanceof Error
      ? lastNetworkError
      : new Error("Failed to reach the lifecycle API.");
  }

  if (resolvedBaseUrl && resolvedBaseUrl !== originalBaseUrl) {
    saveSettings({
      ...settings,
      apiBaseUrl: resolvedBaseUrl,
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await parseJsonSafely(response, options.allowEmptyJson)) as T;
}

function normalizeSandboxList(payload: SandboxListPayload): Sandbox[] {
  if (Array.isArray(payload)) return payload;
  if ("items" in payload && Array.isArray(payload.items)) return payload.items;
  if ("sandboxes" in payload && Array.isArray(payload.sandboxes)) return payload.sandboxes;
  return [];
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
  const response = await request<SandboxListPayload>(settings, `/sandboxes${query ? `?${query}` : ""}`);
  return normalizeSandboxList(response);
}

export function fetchSandbox(settings: AdminSettings, sandboxId: string) {
  return request<Sandbox>(settings, `/sandboxes/${sandboxId}`);
}

export function createSandbox(settings: AdminSettings, payload: CreateSandboxRequest) {
  const body: CreateSandboxRequest = {
    ...payload,
    ...(payload.entrypoint && payload.entrypoint.length > 0 ? { entrypoint: payload.entrypoint } : {}),
  };
  return request<Sandbox>(settings, "/sandboxes", {
    method: "POST",
    body: JSON.stringify(body),
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

export function proxyPing(settings: AdminSettings, sandboxId: string, port = "44772") {
  return request(settings, `/sandboxes/${sandboxId}/proxy/${port}/ping`);
}

export async function fetchSandboxProxyHealth(
  settings: AdminSettings,
  sandboxId: string,
  port = "8080",
): Promise<boolean> {
  await request<{ ok?: boolean; status?: string }>(settings, `/sandboxes/${sandboxId}/proxy/${port}/healthz`);
  return true;
}

export async function runCommand(
  settings: ApiSettings,
  sandboxId: string,
  command: string,
  port = "44772",
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

export async function runSandboxCommand(
  settings: ApiSettings,
  sandboxId: string,
  payload: {
    command: string;
    cwd?: string;
    timeout?: number;
    background?: boolean;
    envs?: Record<string, string>;
  },
  port = "44772",
) {
  return request(settings, `/sandboxes/${sandboxId}/proxy/${port}/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function runCode(
  settings: ApiSettings,
  sandboxId: string,
  code: string,
  port = "44772",
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
