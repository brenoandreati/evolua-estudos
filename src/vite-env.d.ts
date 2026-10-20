/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID do Google para o botão "Continuar com Google" (opcional). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
