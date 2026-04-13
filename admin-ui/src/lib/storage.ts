import type { AdminSettings } from "../types";

const STORAGE_KEY = "opensandbox-admin-settings";

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

export const defaultSettings: AdminSettings = {
  apiBaseUrl: "http://127.0.0.1:8090/v1",
  apiKey: "",
  autoRefreshSeconds: 10,
};

export function getApiBaseUrlCandidates(apiBaseUrl: string) {
  const configured = normalizeApiBaseUrl(apiBaseUrl || defaultSettings.apiBaseUrl);
  const candidates = new Set<string>([configured]);

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "127.0.0.1";
    candidates.add(`${protocol}//${hostname}:8090/v1`);

    if (hostname === "localhost") {
      candidates.add(`${protocol}//127.0.0.1:8090/v1`);
    } else if (hostname === "127.0.0.1") {
      candidates.add(`${protocol}//localhost:8090/v1`);
    }
  }

  candidates.add(defaultSettings.apiBaseUrl);
  candidates.add("http://localhost:8090/v1");
  candidates.add("http://127.0.0.1:8090/v1");

  return [...candidates];
}

export function loadSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      apiBaseUrl: normalizeApiBaseUrl(parsed.apiBaseUrl ?? defaultSettings.apiBaseUrl),
      apiKey: parsed.apiKey ?? defaultSettings.apiKey,
      autoRefreshSeconds: parsed.autoRefreshSeconds ?? defaultSettings.autoRefreshSeconds,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AdminSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...settings,
      apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl),
    }),
  );
}
