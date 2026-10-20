import { requireUser } from '../../../server/accounts';
import type { Env } from '../../../server/env';
import { clearSessionCookie, json } from '../../../server/http';

/** Exclui a conta e todos os dados dela (sessões e atividades vão junto). */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const user = await requireUser(env.DB, request);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM study_data WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(user.email),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } });
};
