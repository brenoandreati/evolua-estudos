import type { StudyData } from '../domain/types';
import { parseStudyData } from './schema';

/**
 * Na primeira versão, contas e dados ficavam só no navegador. Ao entrar com
 * o mesmo e-mail na versão com servidor, esses dados são levados para a nuvem
 * uma única vez e depois apagados do navegador.
 */

const LOCAL_ACCOUNTS_KEY = 'evolua-estudos:contas:v1';
const LOCAL_SESSION_KEY = 'evolua-estudos:sessao:v1';
const LOCAL_DATA_PREFIX = 'evolua-estudos:dados:v1:';

interface LocalAccount {
  id: string;
  email: string;
}

function readLocalAccounts(): LocalAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

/** Dados guardados neste navegador para a conta com este e-mail (se houver algo). */
export function findLegacyLocalData(email: string): StudyData | null {
  const account = readLocalAccounts().find((a) => a.email === email.trim().toLowerCase());
  if (!account) return null;
  try {
    const data = parseStudyData(JSON.parse(localStorage.getItem(LOCAL_DATA_PREFIX + account.id) ?? 'null'));
    return data && (data.disciplines.length > 0 || data.activities.length > 0) ? data : null;
  } catch {
    return null;
  }
}

/** Apaga do navegador a conta antiga com este e-mail e os dados dela. */
export function forgetLegacyLocalData(email: string): void {
  try {
    const accounts = readLocalAccounts();
    const account = accounts.find((a) => a.email === email.trim().toLowerCase());
    if (!account) return;
    localStorage.removeItem(LOCAL_DATA_PREFIX + account.id);
    const rest = accounts.filter((a) => a.id !== account.id);
    if (rest.length > 0) localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(rest));
    else localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // Sem acesso ao armazenamento: nada a apagar.
  }
}
