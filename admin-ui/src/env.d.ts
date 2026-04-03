/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENSANDBOX_API_BASE_URL?: string;
  readonly VITE_OPENSANDBOX_AUTO_REFRESH_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
