import { normalizeEmail } from '../../../src/auth/validation';
import {
  assertNotLocked,
  clearFailures,
  createSession,
  findUserByEmail,
  recordFailure,
  toPublicUser,
} from '../../../server/accounts';
import { PASSWORD_ITERATIONS, hashPassword, isDerivedPassword, randomSalt, safeEqual } from '../../../server/crypto';
import type { Env } from '../../../server/env';
import { HttpError, json, readJson, sessionCookie, str } from '../../../server/http';

/** Entra com e-mail e senha. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);
  const email = normalizeEmail(str(body.email));
  const password = str(body.password);
  if (!email) throw new HttpError(400, 'Informe seu e-mail.', 'email');
  if (!password) throw new HttpError(400, 'Informe sua senha.', 'password');
  if (!isDerivedPassword(password)) throw new HttpError(400, 'Senha inválida.', 'password');

  await assertNotLocked(env.DB, email);
  const user = await findUserByEmail(env.DB, email);

  if (user && !user.password_hash) {
    throw new HttpError(400, 'Esta conta foi criada com o Google. Use “Continuar com o Google”.', 'email');
  }

  // Mesmo sem conta, calcula um hash para a resposta levar o mesmo tempo.
  const hash = await hashPassword(
    password,
    user?.password_salt ?? randomSalt(),
    user?.password_iterations ?? PASSWORD_ITERATIONS,
  );
  if (!user?.password_hash || !safeEqual(hash, user.password_hash)) {
    await recordFailure(env.DB, email);
    throw new HttpError(401, 'E-mail ou senha incorretos.', 'email');
  }

  await clearFailures(env.DB, email);
  const remember = body.remember !== false;
  const token = await createSession(env.DB, user.id, remember);
  return json({ user: toPublicUser(user) }, { headers: { 'Set-Cookie': sessionCookie(request, token, remember) } });
};
