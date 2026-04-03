import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { defaultSettings, loadSettings, saveSettings } from "../lib/storage";
import type { AdminSettings } from "../types";

interface SettingsContextValue {
  settings: AdminSettings;
  updateSettings: (nextSettings: AdminSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  updateSettings: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AdminSettings>(() => loadSettings());

  function updateSettings(nextSettings: AdminSettings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
