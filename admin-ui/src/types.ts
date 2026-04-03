export type SandboxState =
  | "Pending"
  | "Running"
  | "Pausing"
  | "Paused"
  | "Stopping"
  | "Terminated"
  | "Failed"
  | string;

export interface SandboxStatus {
  state: SandboxState;
  reason?: string;
  message?: string;
  lastTransitionAt?: string;
}

export interface SandboxImage {
  uri: string;
}

export interface Sandbox {
  id: string;
  image: SandboxImage;
  status: SandboxStatus;
  metadata?: Record<string, string>;
  entrypoint: string[];
  expiresAt?: string | null;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ListSandboxesResponse {
  items: Sandbox[];
  pagination: PaginationInfo;
}

export interface EndpointResponse {
  endpoint: string;
  headers?: Record<string, string>;
}

export interface DiagnosticsBundle {
  summary: string;
  logs: string;
}

export interface AdminSettings {
  apiBaseUrl: string;
  apiKey: string;
  autoRefreshSeconds: number;
}

export interface CreateSandboxRequest {
  image: {
    uri: string;
  };
  timeout?: number | null;
  resourceLimits: Record<string, string>;
  entrypoint: string[];
  env?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface CreateSandboxResponse {
  id: string;
  status: SandboxStatus;
  metadata?: Record<string, string>;
  expiresAt?: string | null;
  createdAt: string;
  entrypoint: string[];
}

export interface RenewExpirationRequest {
  expiresAt: string;
}
