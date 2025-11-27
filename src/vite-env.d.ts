/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MTA_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
