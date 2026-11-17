/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do Core API vista pelo navegador. Padrão: http://localhost:8080. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
