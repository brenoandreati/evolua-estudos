/** Recursos disponíveis para as funções do servidor (configurados em wrangler.toml). */
export interface Env {
  DB: D1Database;
  /** Client ID do Google para "Continuar com o Google" (opcional). */
  GOOGLE_CLIENT_ID?: string;
}

export type Context = EventContext<Env, string, Record<string, unknown>>;
