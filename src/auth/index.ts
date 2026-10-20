import { HttpAuthService } from './httpAuthService';
import type { AuthService } from './types';

/** Ponto único de troca da forma de acesso. */
export function createAuthService(): AuthService {
  return new HttpAuthService();
}

export type { AuthService, User } from './types';
