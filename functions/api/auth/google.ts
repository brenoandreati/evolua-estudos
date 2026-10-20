import { normalizeEmail } from '../../../src/auth/validation';
import { createSession, createUser, findUserByEmail, findUserByGoogleSub, toPublicUser } from '../../../server/accounts';
import type { Env } from '../../../server/env';
import { verifyGoogleCredential } from '../../../server/google';
import { HttpError, json, readJson, sessionCookie, str } from '../../../server/http';

/**
 * Entra (ou cria a conta) com o Google. Se já existe uma conta com o mesmo
 * e-mail — confirmado pelo Google —, ela é vinculada e a pessoa encontra os
 * mesmos dados.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new HttpError(404, 'O login com o Google não está ativado.');

  const body = await readJson(request);
  const profile = await verifyGoogleCredential(str(body.credential), clientId);
  const email = normalizeEmail(profile.email);

  let user = (await findUserByGoogleSub(env.DB, profile.sub)) ?? (await findUserByEmail(env.DB, email));
  if (user && !user.google_sub) {
    await env.DB.prepare('UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?')
      .bind(profile.sub, new Date().toISOString(), user.id)
      .run();
    user = { ...user, google_sub: profile.sub };
  }
  if (!user) {
    const name = (profile.givenName || profile.name || email.split('@')[0]).slice(0, 40);
    user = await createUser(env.DB, { email, name, googleSub: profile.sub });
  }

  const remember = body.remember !== false;
  const token = await createSession(env.DB, user.id, remember);
  return json({ user: toPublicUser(user) }, { headers: { 'Set-Cookie': sessionCookie(request, token, remember) } });
};
