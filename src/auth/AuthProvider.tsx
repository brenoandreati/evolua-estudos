import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createAuthService } from '.';
import type { AuthService, RegisterInput, User } from './types';

type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

interface AuthContextValue {
  state: AuthState;
  register(input: RegisterInput, remember: boolean): Promise<User>;
  login(email: string, password: string, remember: boolean): Promise<User>;
  signInWithGoogle(credential: string, remember: boolean): Promise<User>;
  logout(): Promise<void>;
  updateProfile(profile: { name: string }): Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, service }: { children: ReactNode; service?: AuthService }) {
  const auth = useMemo(() => service ?? createAuthService(), [service]);
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(() => {
    auth
      .currentUser()
      .then((user) => setState(user ? { status: 'signedIn', user } : { status: 'signedOut' }))
      .catch(() => setState({ status: 'signedOut' }));
  }, [auth]);

  useEffect(refresh, [refresh]);
  // Entrar ou sair em uma aba vale para as outras abas abertas.
  useEffect(() => auth.subscribe?.(refresh), [auth, refresh]);

  const signedIn = useCallback((user: User) => {
    setState({ status: 'signedIn', user });
    return user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      register: (input, remember) => auth.register(input, { remember }).then(signedIn),
      login: (email, password, remember) => auth.login(email, password, { remember }).then(signedIn),
      signInWithGoogle: (credential, remember) => auth.signInWithGoogle(credential, { remember }).then(signedIn),
      logout: () => auth.logout().then(() => setState({ status: 'signedOut' })),
      updateProfile: (profile) => {
        if (state.status !== 'signedIn') return Promise.reject(new Error('Nenhuma conta conectada.'));
        return auth.updateProfile(state.user.id, profile).then(signedIn);
      },
    }),
    [auth, signedIn, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return context;
}

/** Conta conectada (use apenas dentro da área logada). */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('Nenhuma conta conectada.');
  return state.user;
}
