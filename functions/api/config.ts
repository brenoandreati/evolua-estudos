import type { Env } from '../../server/env';
import { json } from '../../server/http';

/** Configurações públicas do site (ex.: se o login com Google está ativo). */
export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  json({ googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null });
