import { useEffect, useState } from "react";

import { useSettings } from "../context/settings";
import {
  createSandbox,
  createSandboxTag,
  deleteSandbox,
  deleteSandboxTag,
  fetchDiagnosticsEvents,
  fetchDiagnosticsInspect,
  fetchDiagnosticsLogs,
  fetchDiagnosticsSummary,
  fetchSandbox,
  fetchSandboxEndpoint,
  fetchSandboxNote,
  fetchSandboxTags,
  fetchSandboxes,
  pauseSandbox,
  renewSandboxExpiration,
  resumeSandbox,
  saveSandboxNote,
} from "../lib/api";

import type {
  CreateSandboxRequest,
  DiagnosticsSections,
  EndpointResponse,
  Sandbox,
  SandboxTagItem,
} from "../types";

export function useSandboxCollection() {
  const { settings } = useSettings();
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState<number>(0);

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
    refresh: () => setReloadToken((value:number) => value + 1),
    create: async (request: CreateSandboxRequest) => {
      await createSandbox(settings, request);
      setReloadToken((value:number) => value + 1);
    },
    pause: async (sandboxId: string) => {
      await pauseSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
    },
    resume: async (sandboxId: string) => {
      await resumeSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
    },
    remove: async (sandboxId: string) => {
      await deleteSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
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
    refresh: () => setReloadToken((value:number) => value + 1),
    pause: async () => {
      await pauseSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
    },
    resume: async () => {
      await resumeSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
    },
    remove: async () => {
      await deleteSandbox(settings, sandboxId);
      setReloadToken((value:number) => value + 1);
    },
    renewExpiration: async (expiresAt: string) => {
      await renewSandboxExpiration(settings, sandboxId, { expiresAt });
      setReloadToken((value:number) => value + 1);
    },
  };
}

export function useSandboxDiagnostics(sandboxId: string) {
  const { settings } = useSettings();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSections | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [summary, logs, inspect, events] = await Promise.all([
          fetchDiagnosticsSummary(settings, sandboxId),
          fetchDiagnosticsLogs(settings, sandboxId),
          fetchDiagnosticsInspect(settings, sandboxId),
          fetchDiagnosticsEvents(settings, sandboxId),
        ]);

        if (!cancelled) {
          setDiagnostics({ summary, logs, inspect, events });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể lấy diagnostics.");
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
    refresh: () => setReloadToken((value:number) => value + 1),
  };
}

export function useSandboxAdminData(sandboxId: string) {
  const { settings } = useSettings();
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<SandboxTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [noteResponse, tagResponse] = await Promise.all([
        fetchSandboxNote(settings, sandboxId),
        fetchSandboxTags(settings, sandboxId),
      ]);

      setNote(noteResponse.note || "");
      setTags(tagResponse.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải note/tag.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sandboxId, settings]);

  return {
    note,
    setNote,
    tags,
    loading,
    error,
    reload: load,
    saveNote: async () => {
      await saveSandboxNote(settings, sandboxId, note);
      await load();
    },
    addTag: async (tag: string) => {
      await createSandboxTag(settings, sandboxId, tag);
      await load();
    },
    removeTag: async (tagId: number) => {
      await deleteSandboxTag(settings, tagId);
      await load();
    },
  };
}