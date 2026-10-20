import { adoptLegacyData } from '../data/localStorageRepository';
import { LocalAuthService } from './localAuthService';
import type { AuthService } from './types';

/** Ponto único de troca da forma de acesso (local hoje, servidor no futuro). */
export function createAuthService(): AuthService {
  // A primeira conta do aparelho herda os dados usados antes do acesso por login.
  return new LocalAuthService({ onFirstAccount: adoptLegacyData });
}

export type { AuthService, User } from './types';
