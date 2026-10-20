/** Dados da pessoa conectada que as telas podem usar. */
export interface User {
  id: string;
  /** Nome de usuário: como a plataforma chama a pessoa. */
  name: string;
  email: string;
  /** Como a conta foi criada. */
  provider: 'password' | 'google';
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export type AuthField = 'name' | 'email' | 'password';

/** Erro de acesso com mensagem pronta para exibir e o campo relacionado. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: AuthField,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Contrato de acesso ao painel. A implementação atual (`HttpAuthService`)
 * conversa com o servidor na Cloudflare; as telas só conhecem esta interface.
 */
export interface AuthService {
  currentUser(): Promise<User | null>;
  register(input: RegisterInput, options: { remember: boolean }): Promise<User>;
  login(email: string, password: string, options: { remember: boolean }): Promise<User>;
  /** Entra (ou cria a conta) com a credencial devolvida pelo botão do Google. */
  signInWithGoogle(credential: string, options: { remember: boolean }): Promise<User>;
  logout(): Promise<void>;
  updateProfile(profile: { name: string }): Promise<User>;
  /** Exclui a conta e todos os dados dela. */
  deleteAccount(): Promise<void>;
}
