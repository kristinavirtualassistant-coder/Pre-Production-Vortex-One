/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_DEV_AUTH?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
