import { deleteSession } from '../../../server/accounts';
import type { Env } from '../../../server/env';
import { clearSessionCookie, json } from '../../../server/http';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await deleteSession(env.DB, request);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } });
};
