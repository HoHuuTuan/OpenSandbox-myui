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
  metadata?: Record<string, unknown>;
  entrypoint?: string[];
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

export interface AdminSettings {
  apiBaseUrl: string;
  apiKey: string;
  autoRefreshSeconds: number;
}

export interface CreateSandboxRequest {
  image: {
    uri: string;
  };
  timeout?: number;
  resourceLimits: Record<string, string>;
  entrypoint: string[];
  env?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface RenewExpirationRequest {
  expiresAt: string;
}

export interface CommandStatus {
  id: string;
  content?: string;
  running: boolean;
  exit_code?: number | null;
  error?: string;
  started_at?: string;
  finished_at?: string | null;
}

export interface MetricsSnapshot {
  cpu_count: number;
  cpu_used_pct: number;
  mem_total_mib: number;
  mem_used_mib: number;
  timestamp: number;
}
