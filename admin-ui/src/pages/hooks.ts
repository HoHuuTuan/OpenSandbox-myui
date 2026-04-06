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

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetchSandboxes(settings, requestParams);
        console.log("[fetchSandboxes response]", response);

        let nextItems: Sandbox[] = [];

        if (Array.isArray(response)) {
          nextItems = response;
        } else if (Array.isArray((response as any)?.items)) {
          nextItems = (response as any).items;
        } else if (Array.isArray((response as any)?.sandboxes)) {
          nextItems = (response as any).sandboxes;
        } else {
          nextItems = [];
        }

        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (error) {
        console.error("[useSandboxCollection load error]", error);
        if (!cancelled) {
          setError(errorMessage(error, "Không thể tải danh sách sandbox."));
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    const timer = window.setInterval(
      load,
      Math.max(settings.autoRefreshSeconds, 3) * 1000
    );

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
        await createSandbox(settings, payload);
        setReloadToken((value) => value + 1);
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
    async function load() {
      setLoading(true);
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
          setSandbox(sandboxData);
          setEndpoint(endpointData);
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error, "Không thể tải chi tiết sandbox."));
          setSandbox(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const timer = window.setInterval(load, Math.max(settings.autoRefreshSeconds, 3) * 1000);
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
          summary: `Sandbox ID: ${sandboxId}\nChưa kết nối API chẩn đoán.`,
          logs: "Chưa có endpoint logs.",
          inspect: "Chưa có endpoint inspect.",
          events: "Chưa có endpoint events.",
        };

        if (!cancelled) {
          setDiagnostics(nextData);
        }
      } catch (error) {
        if (!cancelled) {
          setError(errorMessage(error, "Không thể tải chẩn đoán sandbox."));
          setDiagnostics(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

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
