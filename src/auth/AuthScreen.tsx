import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CalendarDays, Eye, EyeOff, LoaderCircle, ShieldCheck, TrendingUp, TriangleAlert } from 'lucide-react';
import { BarsMark, CapIcon, EvoluaNegocioLogo } from '../components/brand/Logo';
import { Field } from '../components/ui/Field';
import { useToast } from '../components/ui/ToastProvider';
import { useAuth } from './AuthProvider';
import { GOOGLE_CLIENT_ID, isGoogleEnabled, loadGoogleIdentity } from './google';
import { AuthError, type AuthField } from './types';
import { PASSWORD_HINT, emailError, nameError, passwordError } from './validation';

type Mode = 'login' | 'register' | 'forgot';
type Errors = Partial<Record<AuthField | 'confirm' | 'form', string>>;

const TITLES: Record<Mode, { title: string; subtitle: string }> = {
  login: { title: 'Entrar', subtitle: 'Acesse seu painel com seu e-mail e senha.' },
  register: { title: 'Criar acesso', subtitle: 'Escolha seu nome de usuário, informe seu e-mail e crie uma senha.' },
  forgot: { title: 'Esqueci minha senha', subtitle: 'Veja como voltar a acessar seu painel.' },
};

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [remember, setRemember] = useState(true);
  const google = isGoogleEnabled();

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
        <div className="auth__signature">
          <EvoluaNegocioLogo tone="light" />
        </div>
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

          {mode !== 'forgot' && (
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

          {mode !== 'forgot' && google && (
            <>
              <GoogleSignIn key={mode} remember={remember} />
              <div className="auth__divider">
                <span>ou com e-mail</span>
              </div>
            </>
          )}

          {mode === 'login' && (
            <LoginForm
              key="login"
              remember={remember}
              onRememberChange={setRemember}
              onForgot={() => setMode('forgot')}
            />
          )}
          {mode === 'register' && <RegisterForm key="register" remember={remember} onRememberChange={setRemember} />}
          {mode === 'forgot' && <ForgotPassword google={google} remember={remember} onBack={() => setMode('login')} />}

          <p className="auth__note">
            <ShieldCheck size={16} aria-hidden />
            <span>
              Seu acesso e seus dados ficam salvos somente neste navegador, neste aparelho. A senha é guardada de
              forma protegida.
            </span>
          </p>

          <div className="auth__mobile-signature">
            <EvoluaNegocioLogo />
          </div>
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

/** Botão oficial "Continuar com Google" (só aparece com o Client ID configurado). */
function GoogleSignIn({ remember }: { remember: boolean }) {
  const { signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // O Google chama o callback mais tarde; refs mantêm os valores atuais.
  const latest = useRef({ remember, signInWithGoogle, showToast });
  latest.current = { remember, signInWithGoogle, showToast };

  useEffect(() => {
    let active = true;
    loadGoogleIdentity()
      .then((api) => {
        const container = containerRef.current;
        if (!active || !container) return;
        api.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          callback: ({ credential }) => {
            const { remember: keep, signInWithGoogle: signIn, showToast: toast } = latest.current;
            setError(undefined);
            setBusy(true);
            signIn(credential, keep)
              .then((user) => toast(`Olá, ${user.name}! Bem-vindo(a) ao seu painel.`))
              .catch((e: unknown) => {
                if (active) setError(e instanceof Error ? e.message : 'Não foi possível entrar com o Google.');
              })
              .finally(() => active && setBusy(false));
          },
        });
        container.replaceChildren();
        api.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.round(Math.min(400, Math.max(220, container.clientWidth))),
          locale: 'pt-BR',
        });
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar o login do Google.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="auth__google">
      <div ref={containerRef} className="auth__google-button" aria-busy={busy} />
      {busy && (
        <p className="auth__google-status">
          <LoaderCircle size={16} className="spin" aria-hidden /> Entrando com o Google…
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------

interface RememberProps {
  remember: boolean;
  onRememberChange: (value: boolean) => void;
}

function LoginForm({ remember, onRememberChange, onForgot }: RememberProps & { onForgot: () => void }) {
  const { login } = useAuth();
  const { showToast } = useToast();
  const { busy, errors, run, clear } = useSubmit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => ({
        email: email.trim() ? undefined : 'Informe seu e-mail.',
        password: password ? undefined : 'Informe sua senha.',
      }),
      async () => {
        const user = await login(email, password, remember);
        showToast(`Bem-vindo(a) de volta, ${user.name}!`);
      },
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field id="auth-email" label="E-mail" error={errors.email}>
        <input
          id="auth-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clear('email');
          }}
          placeholder="voce@email.com"
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
        <RememberCheckbox checked={remember} onChange={onRememberChange} />
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

function RegisterForm({ remember, onRememberChange }: RememberProps) {
  const { register } = useAuth();
  const { showToast } = useToast();
  const { busy, errors, run, clear } = useSubmit();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    clear(key);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(
      () => ({
        name: nameError(form.name),
        email: emailError(form.email),
        password: passwordError(form.password),
        confirm: form.confirm !== form.password ? 'As senhas não conferem.' : undefined,
      }),
      async () => {
        const user = await register({ name: form.name, email: form.email, password: form.password }, remember);
        showToast(`Acesso criado! Bem-vindo(a), ${user.name}.`);
      },
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field
        id="auth-name"
        label="Nome de usuário"
        error={errors.name}
        hint="É assim que a plataforma vai chamar você. Ex.: Breno"
        required
      >
        <input
          id="auth-name"
          type="text"
          autoComplete="nickname"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={40}
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
      <RememberCheckbox checked={remember} onChange={onRememberChange} />
      <FormError message={errors.form} />
      <SubmitButton busy={busy} busyLabel="Criando acesso…">
        Criar acesso e entrar
      </SubmitButton>
    </form>
  );
}

function ForgotPassword({ google, remember, onBack }: { google: boolean; remember: boolean; onBack: () => void }) {
  return (
    <div className="auth__forgot">
      <p>
        Nesta versão, seu acesso fica salvo somente neste navegador. Por isso, ainda não é possível enviar um e-mail
        para redefinir a senha.
      </p>
      {google ? (
        <>
          <p>
            Se o seu e-mail for uma conta Google, use o botão abaixo com esse mesmo e-mail: você entra na sua conta e
            encontra seus dados como deixou.
          </p>
          <GoogleSignIn remember={remember} />
        </>
      ) : (
        <p>A recuperação de senha por e-mail fará parte da versão com contas em servidor.</p>
      )}
      <button type="button" className="button button--secondary auth__submit" onClick={onBack}>
        Voltar para entrar
      </button>
    </div>
  );
}
