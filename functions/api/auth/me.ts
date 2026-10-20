import { sessionUser, toPublicUser } from '../../../server/accounts';
import type { Env } from '../../../server/env';
import { json } from '../../../server/http';

/** Quem está conectado (ou `user: null`). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await sessionUser(env.DB, request);
  return json({ user: user ? toPublicUser(user) : null });
};
