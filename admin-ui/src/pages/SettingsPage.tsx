import { useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { useSettings } from "../context/settings";
import type { AdminSettings } from "../types";

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [draft, setDraft] = useState<AdminSettings>(settings);
  const [savedAt, setSavedAt] = useState("");

  function update<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    updateSettings(draft);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div className="grid">
      <PageHeader
        title="Cài Đặt"
        subtitle="Cấu hình endpoint lifecycle API, API key và chu kỳ tự làm mới cho toàn bộ giao diện quản trị."
      />

      <section className="panel">
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label>
            URL Cơ Sở API
            <input
              className="text-input"
              value={draft.apiBaseUrl}
              onChange={(event) => update("apiBaseUrl", event.target.value)}
              placeholder="http://127.0.0.1:8080/v1"
            />
          </label>

          <label>
            API Key
            <input
              className="text-input"
              type="password"
              value={draft.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              placeholder="OPEN-SANDBOX-API-KEY"
            />
          </label>

          <label>
            Chu Kỳ Tự Làm Mới (giây)
            <input
              className="text-input"
              type="number"
              min={3}
              value={draft.autoRefreshSeconds}
              onChange={(event) => update("autoRefreshSeconds", Number(event.target.value))}
            />
          </label>

          <div className="page-actions">
            <button className="button" type="submit">
              Lưu cài đặt
            </button>
            <button className="ghost-button" type="button" onClick={() => setDraft(settings)}>
              Đặt lại form
            </button>
          </div>

          <p className="helper-text">
            Cài đặt được lưu trong local storage của trình duyệt. Base URL mặc định được lấy từ biến môi trường Vite và thường nên kết thúc bằng <span className="inline-code">/v1</span>.
          </p>
          {savedAt ? <p className="helper-text">Đã lưu lúc {savedAt}</p> : null}
        </form>
      </section>
    </div>
  );
}
