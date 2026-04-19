import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../context/settings";
import {
  createSandbox,
  deleteSandbox,
  fetchSandbox,
  fetchSandboxEndpoint,
  fetchSandboxes,
  pauseSandbox,
  renewSandboxExpiration,
  resumeSandbox,
} from "../lib/api";
import type { CreateSandboxRequest, EndpointResponse, Sandbox } from "../types";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sameHeaders(
  left?: Record<string, string>,
  right?: Record<string, string>,
) {
  const leftEntries = Object.entries(left ?? {}).sort();
  const rightEntries = Object.entries(right ?? {}).sort();
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([key, value], index) => {
    const [otherKey, otherValue] = rightEntries[index] ?? [];
    return key === otherKey && value === otherValue;
  });
}

function sameEndpoint(left: EndpointResponse | null, right: EndpointResponse | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.endpoint === right.endpoint && sameHeaders(left.headers, right.headers);
}

function sameSandbox(left: Sandbox | null, right: Sandbox | null) {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.id === right.id &&
    left.image.uri === right.image.uri &&
    left.createdAt === right.createdAt &&
    left.expiresAt === right.expiresAt &&
    left.status.state === right.status.state &&
    left.status.reason === right.status.reason &&
    left.status.message === right.status.message &&
    left.status.lastTransitionAt === right.status.lastTransitionAt &&
    JSON.stringify(left.metadata ?? {}) === JSON.stringify(right.metadata ?? {}) &&
    JSON.stringify(left.entrypoint ?? []) === JSON.stringify(right.entrypoint ?? [])
  );
}

function sameSandboxList(left: Sandbox[], right: Sandbox[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => sameSandbox(item, right[index] ?? null));
}

export function useSandboxCollection(filters: { state: string; metadata: string; pageSize: number }) {
  const { settings } = useSettings();
  const [items, setItems] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);

  const requestParams = useMemo(
    () => ({
      state: filters.state || undefined,
      metadata: filters.metadata || undefined,
      pageSize: filters.pageSize,
    }),
    [filters.metadata, filters.pageSize, filters.state],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      setError("");

      try {
        const nextItems = await fetchSandboxes(settings, requestParams);
        if (!cancelled) {
          setItems((current) => (sameSandboxList(current, nextItems) ? current : nextItems));
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error, "Could not load sandboxes."));
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(true);

    const timer = window.setInterval(() => {
      void load(false);
    }, Math.max(settings.autoRefreshSeconds, 3) * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [requestParams, reloadToken, settings]);

  return {
    items,
    loading,
    error,
    busy,
    refresh: () => setReloadToken((value) => value + 1),
    create: async (payload: CreateSandboxRequest) => {
      setBusy(true);
      try {
        const created = await createSandbox(settings, payload);
        setReloadToken((value) => value + 1);
        return created;
      } finally {
        setBusy(false);
      }
    },
  };
}

export function useSandboxDetails(sandboxId: string, endpointPort: string, useServerProxy: boolean) {
  const { settings } = useSettings();
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [endpoint, setEndpoint] = useState<EndpointResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      setError("");

      try {
        const sandboxData = await fetchSandbox(settings, sandboxId);
        let endpointData: EndpointResponse | null = null;

        if (endpointPort.trim()) {
          try {
            endpointData = await fetchSandboxEndpoint(settings, sandboxId, endpointPort.trim(), useServerProxy);
          } catch {
            endpointData = null;
          }
        }

        if (!cancelled) {
          setSandbox((current) => (sameSandbox(current, sandboxData) ? current : sandboxData));
          setEndpoint((current) => (sameEndpoint(current, endpointData) ? current : endpointData));
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error, "Could not load sandbox details."));
          setSandbox(null);
          setEndpoint(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => {
      void load(false);
    }, Math.max(settings.autoRefreshSeconds, 3) * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [endpointPort, reloadToken, sandboxId, settings, useServerProxy]);

  return {
    sandbox,
    endpoint,
    loading,
    error,
    refresh: () => setReloadToken((value) => value + 1),
    pause: async () => {
      await pauseSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
    resume: async () => {
      await resumeSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
    remove: async () => {
      await deleteSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
    renewExpiration: async (expiresAt: string) => {
      await renewSandboxExpiration(settings, sandboxId, { expiresAt });
      setReloadToken((value) => value + 1);
    },
  };
}

type Diagnostics = {
  summary: string;
  logs: string;
  inspect: string;
  events: string;
};

export function useSandboxDiagnostics(sandboxId: string) {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const nextData: Diagnostics = {
          summary: `Sandbox ID: ${sandboxId}\nDiagnostic APIs are not wired yet.`,
          logs: "Logs endpoint is not configured yet.",
          inspect: "Inspect endpoint is not configured yet.",
          events: "Events endpoint is not configured yet.",
        };

        if (!cancelled) {
          setDiagnostics(nextData);
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error, "Could not load sandbox diagnostics."));
          setDiagnostics(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sandboxId, reloadToken]);

  return {
    diagnostics,
    loading,
    error,
    refresh: () => setReloadToken((value) => value + 1),
  };
}
