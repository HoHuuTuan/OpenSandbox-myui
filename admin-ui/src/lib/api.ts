import type {
  AdminSettings,
  CreateSandboxRequest,
  CreateSandboxResponse,
  EndpointResponse,
  ListSandboxesResponse,
  RenewExpirationRequest,
  Sandbox,
  SandboxNoteResponse,
  SandboxTagsResponse,
} from "../types";

function buildHeaders(settings: AdminSettings): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(settings.apiKey ? { "OPEN-SANDBOX-API-KEY": settings.apiKey } : {}),
  };
}

async function requestJson<T>(
  settings: AdminSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${settings.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(settings),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestText(
  settings: AdminSettings,
  path: string,
): Promise<string> {
  const response = await fetch(`${settings.apiBaseUrl}${path}`, {
    headers: buildHeaders(settings),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.text();
}

// =========================
// SANDBOX API
// =========================

export function fetchSandboxes(
  settings: AdminSettings,
  params?: {
    state?: string[];
    metadata?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const search = new URLSearchParams();

  params?.state?.forEach((value) => search.append("state", value));
  if (params?.metadata) search.set("metadata", params.metadata);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));

  const query = search.toString();

  return requestJson<ListSandboxesResponse>(
    settings,
    `/sandboxes${query ? `?${query}` : ""}`,
  );
}

export function fetchSandbox(settings: AdminSettings, sandboxId: string) {
  return requestJson<Sandbox>(settings, `/sandboxes/${sandboxId}`);
}

export function createSandbox(settings: AdminSettings, payload: CreateSandboxRequest) {
  return requestJson<CreateSandboxResponse>(settings, `/sandboxes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pauseSandbox(settings: AdminSettings, sandboxId: string) {
  return requestJson<void>(settings, `/sandboxes/${sandboxId}/pause`, {
    method: "POST",
  });
}

export function resumeSandbox(settings: AdminSettings, sandboxId: string) {
  return requestJson<void>(settings, `/sandboxes/${sandboxId}/resume`, {
    method: "POST",
  });
}

export function deleteSandbox(settings: AdminSettings, sandboxId: string) {
  return requestJson<void>(settings, `/sandboxes/${sandboxId}`, {
    method: "DELETE",
  });
}

export function renewSandboxExpiration(
  settings: AdminSettings,
  sandboxId: string,
  payload: RenewExpirationRequest,
) {
  return requestJson<void>(settings, `/sandboxes/${sandboxId}/renew-expiration`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSandboxEndpoint(
  settings: AdminSettings,
  sandboxId: string,
  port: string,
) {
  return requestJson<EndpointResponse>(
    settings,
    `/sandboxes/${sandboxId}/endpoints/${port}?use_server_proxy=true`,
  );
}

// =========================
// DIAGNOSTICS
// =========================

export function fetchDiagnosticsSummary(settings: AdminSettings, sandboxId: string) {
  return requestText(settings, `/sandboxes/${sandboxId}/diagnostics/summary`);
}

export function fetchDiagnosticsLogs(settings: AdminSettings, sandboxId: string) {
  return requestText(settings, `/sandboxes/${sandboxId}/diagnostics/logs`);
}

export function fetchDiagnosticsInspect(settings: AdminSettings, sandboxId: string) {
  return requestText(settings, `/sandboxes/${sandboxId}/diagnostics/inspect`);
}

export function fetchDiagnosticsEvents(settings: AdminSettings, sandboxId: string) {
  return requestText(settings, `/sandboxes/${sandboxId}/diagnostics/events`);
}

// =========================
// ADMIN (DB)
// =========================

export function fetchSandboxNote(settings: AdminSettings, sandboxId: string) {
  return requestJson<SandboxNoteResponse>(settings, `/admin/sandboxes/${sandboxId}/note`);
}

export function saveSandboxNote(
  settings: AdminSettings,
  sandboxId: string,
  note: string,
) {
  return requestJson<SandboxNoteResponse>(settings, `/admin/sandboxes/${sandboxId}/note`, {
    method: "PUT",
    body: JSON.stringify({ note }),
  });
}

export function fetchSandboxTags(settings: AdminSettings, sandboxId: string) {
  return requestJson<SandboxTagsResponse>(settings, `/admin/sandboxes/${sandboxId}/tags`);
}

export function createSandboxTag(
  settings: AdminSettings,
  sandboxId: string,
  tag: string,
) {
  return requestJson(settings, `/admin/sandboxes/${sandboxId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag }),
  });
}

export function deleteSandboxTag(settings: AdminSettings, tagId: number) {
  return requestJson(settings, `/admin/tags/${tagId}`, {
    method: "DELETE",
  });
}