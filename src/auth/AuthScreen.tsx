import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CalendarDays, Eye, EyeOff, LoaderCircle, ShieldCheck, TrendingUp, TriangleAlert } from 'lucide-react';
import { BarsMark, CapIcon } from '../components/brand/Logo';
import { Field } from '../components/ui/Field';
import { useToast } from '../components/ui/ToastProvider';
import { useAuth } from './AuthProvider';
import { formatCpf } from './cpf';
import { AuthError, type AuthField } from './types';
import { PASSWORD_HINT, cpfError, emailError, passwordError } from './validation';

type Mode = 'login' | 'register' | 'reset';
type Errors = Partial<Record<AuthField | 'confirm' | 'form', string>>;

const TITLES: Record<Mode, { title: string; subtitle: string }> = {
  login: { title: 'Entrar', subtitle: 'Acesse seu painel com e-mail ou CPF e sua senha.' },
  register: { title: 'Criar acesso', subtitle: 'Cadastre seu e-mail, CPF e uma senha para usar o painel.' },
  reset: { title: 'Redefinir senha', subtitle: 'Confirme seu e-mail e CPF para criar uma nova senha.' },
};

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [prefillEmail, setPrefillEmail] = useState('');

  useEffect(() => {
    document.title = `${TITLES[mode].title} · Evolua Meus Estudos`;
  }, [mode]);

  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden>
        <div className="auth__brand-inner">
          <span className="auth__logo">
            <CapIcon size={64} />
          </span>
          <p className="auth__name">Evolua Meus Estudos</p>
          <p className="auth__tagline">Seu curso em um só lugar</p>
          <ul className="auth__highlights">
            <li>
              <TriangleAlert size={18} /> Prazos com alerta por cores
            </li>
            <li>
              <TrendingUp size={18} /> Progresso calculado automaticamente
            </li>
            <li>
              <CalendarDays size={18} /> Calendário com todas as entregas
            </li>
          </ul>
        </div>
        <BarsMark width={220} className="auth__bars" />
      </aside>

      <main className="auth__panel">
        <div className="auth__card">
          <div className="auth__mobile-brand">
            <span className="logo__mark auth__mobile-mark">
              <CapIcon size={30} />
            </span>
            <div>
              <p className="auth__mobile-name">Evolua Meus Estudos</p>
              <p className="auth__mobile-tagline">Seu curso em um só lugar</p>
            </div>
          </div>

          {mode !== 'reset' && (
            <div className="auth__tabs" role="tablist" aria-label="Acesso">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'is-active' : ''}
                onClick={() => setMode('login')}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={mode === 'register' ? 'is-active' : ''}
                onClick={() => setMode('register')}
              >
                Criar acesso
              </button>
            </div>
          )}

          <header className="auth__header">
            <h1>{TITLES[mode].title}</h1>
            <p>{TITLES[mode].subtitle}</p>
          </header>

          {mode === 'login' && (
            <LoginForm key="login" initialIdentifier={prefillEmail} onForgot={() => setMode('reset')} />
          )}
          {mode === 'register' && <RegisterForm key="register" />}
          {mode === 'reset' && (
            <ResetForm
              key="reset"
              onCancel={() => setMode('login')}
              onDone={(email) => {
                setPrefillEmail(email);
                setMode('login');
              }}
            />
          )}

          <p className="auth__note">
            <ShieldCheck size={16} aria-hidden />
            <span>
              Seu acesso e seus dados ficam salvos somente neste navegador, neste aparelho. A senha e o CPF são
              guardados de forma protegida.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const run = async (validate: () => Errors, action: () => Promise<unknown>) => {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      focusFirstError(found);
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (error) {
      const field: AuthField | 'form' = error instanceof AuthError && error.field ? error.field : 'form';
      const message = error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
      const next: Errors = { [field]: message };
      setErrors(next);
      focusFirstError(next);
    } finally {
      setBusy(false);
    }
  };

  const clear = (field: keyof Errors) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  return { busy, errors, run, clear };
}

function focusFirstError(errors: Errors) {
  const field = Object.keys(errors).find((k) => errors[k as keyof Errors]);
  if (field) document.getElementById(`auth-${field}`)?.focus();
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="auth__error" role="alert">
      <TriangleAlert size={16} aria-hidden />
      {message}
    </p>
  );
}

function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <button type="submit" className="button button--primary auth__submit" disabled={busy}>
      {busy ? (
        <>
          <LoaderCircle size={18} className="spin" aria-hidden />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        {...rest}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}

function RememberCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="auth__remember">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Manter conectado neste aparelho
    </label>
  );
}

// ---------------------------------------------------------------------------

function LoginForm({ initialIdentifier, onForgot }: { initialIdentifier: string; onForgot: () => void }) {
  const { login } = useAuth();
  const { showToast } = useToast();
  const { busy, errors, run, clear } = useSubmit();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => ({
        identifier: identifier.trim() ? undefined : 'Informe seu e-mail ou CPF.',
        password: password ? undefined : 'Informe sua senha.',
      }),
      async () => {
        const user = await login(identifier, password, remember);
        showToast(user.name ? `Bem-vindo(a) de volta, ${user.name.split(' ')[0]}!` : 'Bem-vindo(a) de volta!');
      },
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field id="auth-identifier" label="E-mail ou CPF" error={errors.identifier}>
        <input
          id="auth-identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            clear('identifier');
          }}
          placeholder="voce@email.com ou 000.000.000-00"
        />
      </Field>
      <Field id="auth-password" label="Senha" error={errors.password}>
        <PasswordInput
          id="auth-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clear('password');
          }}
          autoComplete="current-password"
        />
      </Field>
      <div className="auth__row">
        <RememberCheckbox checked={remember} onChange={setRemember} />
        <button type="button" className="link-button" onClick={onForgot}>
          Esqueci minha senha
        </button>
      </div>
      <FormError message={errors.form} />
      <SubmitButton busy={busy} busyLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const { busy, errors, run, clear } = useSubmit();
  const [form, setForm] = useState({ name: '', email: '', cpf: '', password: '', confirm: '' });
  const [remember, setRemember] = useState(true);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: key === 'cpf' ? formatCpf(value) : value }));
    clear(key);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => ({
        email: emailError(form.email),
        cpf: cpfError(form.cpf),
        password: passwordError(form.password),
        confirm: form.confirm !== form.password ? 'As senhas não conferem.' : undefined,
      }),
      async () => {
        await register({ name: form.name, email: form.email, cpf: form.cpf, password: form.password }, remember);
        showToast('Acesso criado! Seu painel já está pronto.');
      },
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field id="auth-name" label="Nome" hint="Opcional. Usado na saudação do painel.">
        <input
          id="auth-name"
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={60}
        />
      </Field>
      <Field id="auth-email" label="E-mail" error={errors.email} required>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="voce@email.com"
        />
      </Field>
      <Field id="auth-cpf" label="CPF" error={errors.cpf} required>
        <input
          id="auth-cpf"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={form.cpf}
          onChange={(e) => set('cpf', e.target.value)}
          placeholder="000.000.000-00"
        />
      </Field>
      <Field id="auth-password" label="Senha" error={errors.password} hint={PASSWORD_HINT} required>
        <PasswordInput
          id="auth-password"
          value={form.password}
          onChange={(v) => set('password', v)}
          autoComplete="new-password"
        />
      </Field>
      <Field id="auth-confirm" label="Confirme a senha" error={errors.confirm} required>
        <PasswordInput
          id="auth-confirm"
          value={form.confirm}
          onChange={(v) => set('confirm', v)}
          autoComplete="new-password"
        />
      </Field>
      <RememberCheckbox checked={remember} onChange={setRemember} />
      <FormError message={errors.form} />
      <SubmitButton busy={busy} busyLabel="Criando acesso…">
        Criar acesso e entrar
      </SubmitButton>
    </form>
  );
}

function ResetForm({ onCancel, onDone }: { onCancel: () => void; onDone: (email: string) => void }) {
  const { resetPassword } = useAuth();
  const { showToast } = useToast();
  const { busy, errors, run, clear } = useSubmit();
  const [form, setForm] = useState({ email: '', cpf: '', password: '', confirm: '' });

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: key === 'cpf' ? formatCpf(value) : value }));
    clear(key);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => ({
        email: emailError(form.email),
        cpf: cpfError(form.cpf),
        password: passwordError(form.password),
        confirm: form.confirm !== form.password ? 'As senhas não conferem.' : undefined,
      }),
      async () => {
        await resetPassword({ email: form.email, cpf: form.cpf, password: form.password });
        showToast('Senha redefinida. Entre com a nova senha.');
        onDone(form.email.trim());
      },
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field id="auth-email" label="E-mail cadastrado" error={errors.email} required>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </Field>
      <Field id="auth-cpf" label="CPF cadastrado" error={errors.cpf} required>
        <input
          id="auth-cpf"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={form.cpf}
          onChange={(e) => set('cpf', e.target.value)}
          placeholder="000.000.000-00"
        />
      </Field>
      <Field id="auth-password" label="Nova senha" error={errors.password} hint={PASSWORD_HINT} required>
        <PasswordInput
          id="auth-password"
          value={form.password}
          onChange={(v) => set('password', v)}
          autoComplete="new-password"
        />
      </Field>
      <Field id="auth-confirm" label="Confirme a nova senha" error={errors.confirm} required>
        <PasswordInput
          id="auth-confirm"
          value={form.confirm}
          onChange={(v) => set('confirm', v)}
          autoComplete="new-password"
        />
      </Field>
      <FormError message={errors.form} />
      <SubmitButton busy={busy} busyLabel="Salvando…">
        Redefinir senha
      </SubmitButton>
      <button type="button" className="button button--ghost" onClick={onCancel}>
        Voltar para entrar
      </button>
    </form>
  );
}
