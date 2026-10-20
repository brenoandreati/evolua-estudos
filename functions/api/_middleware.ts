import type { Env } from '../../server/env';
import { HttpError, json } from '../../server/http';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Vale para todas as rotas /api:
 * - alterações só a partir do próprio site (origem conferida e corpo JSON),
 *   o que impede que outro site use a sessão de quem está conectado;
 * - respostas nunca ficam em cache;
 * - erros viram mensagens em português.
 */
export const onRequest: PagesFunction<Env> = async ({ request, next }) => {
  try {
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.get('Origin');
      if (origin && origin !== new URL(request.url).origin) {
        throw new HttpError(403, 'Origem não permitida.');
      }
      if (!request.headers.get('Content-Type')?.includes('application/json')) {
        throw new HttpError(415, 'Envie os dados em JSON.');
      }
    }
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message, field: error.field }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error(error);
    return json({ error: 'Erro no servidor. Tente novamente em instantes.' }, { status: 500 });
  }
};
