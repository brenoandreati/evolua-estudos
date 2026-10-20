/** Erro com status HTTP e mensagem pronta para mostrar na tela. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}

const MAX_BODY_BYTES = 1_500_000;

/** Lê o corpo JSON da requisição, com limite de tamanho. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Os dados enviados são grandes demais.');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Os dados enviados são grandes demais.');
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as T;
  } catch {
    throw new HttpError(400, 'Requisição inválida.');
  }
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------------------
// Cookie de sessão

export const SESSION_COOKIE = 'evolua_sessao';
export const REMEMBER_DAYS = 30;

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function cookieAttributes(request: Request): string {
  // "Secure" só em https (o teste local roda em http://localhost).
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * "Manter conectado": cookie com validade de 30 dias.
 * Sem essa opção: cookie de sessão, que some ao fechar o navegador.
 */
export function sessionCookie(request: Request, token: string, remember: boolean): string {
  const maxAge = remember ? `; Max-Age=${REMEMBER_DAYS * 86_400}` : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(request)}${maxAge}`;
}

export function clearSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request)}; Max-Age=0`;
}
