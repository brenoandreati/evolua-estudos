import { emailError, nameError, normalizeEmail } from '../../../src/auth/validation';
import { createSession, createUser, findUserByEmail, toPublicUser } from '../../../server/accounts';
import { PASSWORD_ITERATIONS, hashPassword, isDerivedPassword, randomSalt } from '../../../server/crypto';
import type { Env } from '../../../server/env';
import { HttpError, json, readJson, sessionCookie, str } from '../../../server/http';

/** Cria a conta com nome de usuário, e-mail e senha, e já entra. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);
  const name = str(body.name).trim().slice(0, 40);
  const email = normalizeEmail(str(body.email));
  const password = str(body.password);

  const problems: [string | undefined, string][] = [
    [nameError(name), 'name'],
    [emailError(email), 'email'],
    [isDerivedPassword(password) ? undefined : 'Senha inválida.', 'password'],
  ];
  for (const [message, field] of problems) if (message) throw new HttpError(400, message, field);

  if (await findUserByEmail(env.DB, email)) {
    throw new HttpError(409, 'Já existe uma conta com este e-mail. Use “Entrar”.', 'email');
  }

  const salt = randomSalt();
  const user = await createUser(env.DB, {
    email,
    name,
    password: { hash: await hashPassword(password, salt, PASSWORD_ITERATIONS), salt, iterations: PASSWORD_ITERATIONS },
  });
  const remember = body.remember !== false;
  const token = await createSession(env.DB, user.id, remember);
  return json(
    { user: toPublicUser(user) },
    { status: 201, headers: { 'Set-Cookie': sessionCookie(request, token, remember) } },
  );
};
