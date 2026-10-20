/** Evento disparado quando o servidor diz que a sessão acabou (ex.: saiu em outra aba). */
export const SESSION_EXPIRED_EVENT = 'evolua:sessao-expirada';

/** Erro devolvido pelo servidor, com a mensagem pronta para mostrar. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com a internet. Verifique sua rede e tente novamente.');
    this.name = 'NetworkError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Mantém a requisição viva se a página for fechada no meio do envio. */
  keepalive?: boolean;
  /** Não avisa "sessão terminou" em 401 (usado na tela de acesso). */
  quietUnauthorized?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      keepalive: options.keepalive,
      headers: method === 'GET' ? { Accept: 'application/json' } : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
    });
  } catch {
    throw new NetworkError();
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // resposta sem JSON
  }

  if (!response.ok) {
    if (response.status === 401 && !options.quietUnauthorized) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const message = typeof body.error === 'string' ? body.error : 'Não foi possível concluir. Tente novamente.';
    const field = typeof body.field === 'string' ? body.field : undefined;
    throw new ApiError(response.status, message, field, body);
  }
  return body as T;
}
