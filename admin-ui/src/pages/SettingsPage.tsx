import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useSettings } from "../context/settings";

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid">
      <PageHeader
        eyebrow="Configuration"
        title="Cài đặt API"
        subtitle="Khai báo base URL đúng của lifecycle API. Mặc định chuẩn là http://127.0.0.1:8080/v1."
      />
      <form
        className="panel settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          updateSettings({
            ...form,
            apiBaseUrl: form.apiBaseUrl.trim().replace(/\/$/, ""),
            autoRefreshSeconds: Number(form.autoRefreshSeconds) || 10,
          });
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        }}
      >
        <label>
          API base URL
          <input className="text-input" value={form.apiBaseUrl} onChange={(e) => setForm((s) => ({ ...s, apiBaseUrl: e.target.value }))} />
        </label>
        <label>
          API key
          <input className="text-input" value={form.apiKey} onChange={(e) => setForm((s) => ({ ...s, apiKey: e.target.value }))} />
        </label>
        <label>
          Auto refresh (giây)
          <input className="text-input" value={form.autoRefreshSeconds} onChange={(e) => setForm((s) => ({ ...s, autoRefreshSeconds: Number(e.target.value) || 10 }))} />
        </label>
        <div className="page-actions">
          <button className="button" type="submit">Lưu cài đặt</button>
          {saved ? <span className="helper-text">Đã lưu.</span> : null}
        </div>
      </form>
    </div>
  );
}
