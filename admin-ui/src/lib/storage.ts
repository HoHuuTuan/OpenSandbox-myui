import type { AdminSettings } from "../types";

const STORAGE_KEY = "opensandbox-admin-settings";

export const defaultSettings: AdminSettings = {
  apiBaseUrl: "http://127.0.0.1:8080/v1",
  apiKey: "",
  autoRefreshSeconds: 10,
};

export function loadSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      apiBaseUrl: parsed.apiBaseUrl ?? defaultSettings.apiBaseUrl,
      apiKey: parsed.apiKey ?? defaultSettings.apiKey,
      autoRefreshSeconds: parsed.autoRefreshSeconds ?? defaultSettings.autoRefreshSeconds,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AdminSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
