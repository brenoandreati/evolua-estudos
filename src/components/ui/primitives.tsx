import type { ComponentType, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { URGENCY_INFO } from '../../domain/activities';
import type { Urgency } from '../../domain/types';
import { BarsMark } from '../brand/Logo';

type IconComponent = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

export function ProgressBar({
  value,
  label,
  size = 'md',
}: {
  /** Percentual exato (0–100). */
  value: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`progress progress--${size}${clamped >= 100 ? ' progress--done' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div className="progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span className={`badge badge--${urgency}`}>
      <span className="badge__dot" aria-hidden />
      {URGENCY_INFO[urgency].label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: IconComponent;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'success';
}) {
  return (
    <div className={`empty-state empty-state--${tone}`}>
      <span className="empty-state__icon">
        <Icon size={24} aria-hidden />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  icon: Icon,
  link,
  children,
  className = '',
  description,
}: {
  title: string;
  icon?: IconComponent;
  link?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  description?: ReactNode;
}) {
  return (
    <section className={`card section ${className}`}>
      <header className="section__header">
        <div>
          <h2 className="section__title">
            {Icon && <Icon size={18} className="section__icon" aria-hidden />}
            {title}
          </h2>
          {description && <p className="section__description">{description}</p>}
        </div>
        {link && (
          <a className="section__link" href={link.href}>
            {link.label}
            <ArrowRight size={16} aria-hidden />
          </a>
        )}
      </header>
      {children}
    </section>
  );
}

export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status">
      <BarsMark width={44} className="bars-mark bars-mark--loading" />
      <span>Carregando seu painel…</span>
    </div>
  );
}
