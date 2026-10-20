const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_HINT = 'Mínimo de 8 caracteres, com letras e números.';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nameError(name: string): string | undefined {
  if (!name.trim()) return 'Informe como você quer ser chamado(a).';
  return undefined;
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(email.trim())) return 'Informe um e-mail válido.';
  return undefined;
}

export function passwordError(password: string): string | undefined {
  if (!password) return 'Crie uma senha.';
  if (password.length < 8 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return PASSWORD_HINT;
  return undefined;
}
