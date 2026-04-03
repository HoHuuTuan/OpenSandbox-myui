import { useEffect, useState } from "react";

import { useSettings } from "../context/settings";
import {
  createSandbox,
  deleteSandbox,
  fetchDiagnostics,
  fetchSandbox,
  fetchSandboxEndpoint,
  fetchSandboxes,
  pauseSandbox,
  renewSandboxExpiration,
  resumeSandbox,
} from "../lib/api";
import type {
  CreateSandboxRequest,
  DiagnosticsBundle,
  EndpointResponse,
  Sandbox,
} from "../types";

export function useSandboxCollection() {
  const { settings } = useSettings();
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetchSandboxes(settings);
        if (!cancelled) {
          setSandboxes(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể lấy danh sách sandbox.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const timer = window.setInterval(load, settings.autoRefreshSeconds * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings, reloadToken]);

  return {
    sandboxes,
    loading,
    error,
    refresh: () => setReloadToken((value) => value + 1),
    create: async (request: CreateSandboxRequest) => {
      await createSandbox(settings, request);
      setReloadToken((value) => value + 1);
    },
    pause: async (sandboxId: string) => {
      await pauseSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
    resume: async (sandboxId: string) => {
      await resumeSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
    remove: async (sandboxId: string) => {
      await deleteSandbox(settings, sandboxId);
      setReloadToken((value) => value + 1);
    },
  };
}

export function useSandboxDetails(sandboxId: string) {
  const { settings } = useSettings();
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [endpointPort, setEndpointPort] = useState("8080");
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
        const sandboxResponse = await fetchSandbox(settings, sandboxId);
        let endpointResponse: EndpointResponse | null = null;

        if (endpointPort.trim()) {
          try {
            endpointResponse = await fetchSandboxEndpoint(settings, sandboxId, endpointPort.trim());
          } catch {
            endpointResponse = null;
          }
        }

        if (!cancelled) {
          setSandbox(sandboxResponse);
          setEndpoint(endpointResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể lấy chi tiết sandbox.");
          setSandbox(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [settings, sandboxId, endpointPort, reloadToken]);

  return {
    sandbox,
    endpoint,
    endpointPort,
    setEndpointPort,
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

export function useSandboxDiagnostics(sandboxId: string) {
  const { settings } = useSettings();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetchDiagnostics(settings, sandboxId);
        if (!cancelled) {
          setDiagnostics(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể lấy chẩn đoán và nhật ký.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    const timer = window.setInterval(load, settings.autoRefreshSeconds * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings, sandboxId, reloadToken]);

  return {
    diagnostics,
    loading,
    error,
    refresh: () => setReloadToken((value) => value + 1),
  };
}
