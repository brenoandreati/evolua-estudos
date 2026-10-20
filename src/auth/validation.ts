import { isValidCpf } from './cpf';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_HINT = 'Mínimo de 8 caracteres, com letras e números.';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(email.trim())) return 'Informe um e-mail válido.';
  return undefined;
}

export function cpfError(cpf: string): string | undefined {
  if (!cpf.trim()) return 'Informe seu CPF.';
  if (!isValidCpf(cpf)) return 'CPF inválido. Confira os números.';
  return undefined;
}

export function passwordError(password: string): string | undefined {
  if (!password) return 'Crie uma senha.';
  if (password.length < 8 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return PASSWORD_HINT;
  return undefined;
}
