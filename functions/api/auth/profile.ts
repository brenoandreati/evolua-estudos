import { nameError } from '../../../src/auth/validation';
import { requireUser, toPublicUser } from '../../../server/accounts';
import type { Env } from '../../../server/env';
import { HttpError, json, readJson, str } from '../../../server/http';

/** Altera o nome de usuário. */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const user = await requireUser(env.DB, request);
  const body = await readJson(request);
  const name = str(body.name).trim().slice(0, 40);
  const problem = nameError(name);
  if (problem) throw new HttpError(400, problem, 'name');
  const updatedAt = new Date().toISOString();
  await env.DB.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').bind(name, updatedAt, user.id).run();
  return json({ user: toPublicUser({ ...user, name, updated_at: updatedAt }) });
};
