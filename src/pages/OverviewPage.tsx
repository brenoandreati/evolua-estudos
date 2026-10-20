import { useMemo } from 'react';
import {
  BookOpen,
  CalendarClock,
  CircleCheckBig,
  Clock,
  ListTodo,
  PartyPopper,
  Plus,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { ActivityList } from '../components/activities/ActivityItem';
import { BarsMark } from '../components/brand/Logo';
import { DisciplineCard } from '../components/disciplines/DisciplineCard';
import { EmptyState, PageHeader, ProgressBar, Section } from '../components/ui/primitives';
import { compareByUrgency, isCompleted, isDueSoon, isOverdue } from '../domain/activities';
import { formatLongDate } from '../domain/dates';
import { computeProgress, formatPercent } from '../domain/progress';
import { paths } from '../router';
import { useCurrentUser } from '../auth/AuthProvider';
import { useStudy } from '../state/StudyProvider';
import { useUI } from '../state/UIProvider';

const ATTENTION_LIMIT = 6;
const UPCOMING_LIMIT = 6;

function greeting(hour: number): string {
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function OverviewPage() {
  const { data, today, hour } = useStudy();
  const user = useCurrentUser();
  const { openNewActivity, openNewDiscipline } = useUI();

  const summary = useMemo(() => {
    const pending = data.activities.filter((a) => !isCompleted(a)).sort(compareByUrgency(today));
    const overdue = pending.filter((a) => isOverdue(a, today));
    const dueSoon = pending.filter((a) => isDueSoon(a, today));
    const attention = [...overdue, ...dueSoon];
    const attentionIds = new Set(attention.map((a) => a.id));
    const upcoming = pending.filter((a) => !attentionIds.has(a.id));
    return {
      pending,
      overdue,
      dueSoon,
      attention,
      upcoming,
      completed: data.activities.length - pending.length,
      progress: computeProgress(data.activities),
    };
  }, [data.activities, today]);

  const { progress } = summary;
  const name = user.name.trim().split(/\s+/)[0] ?? '';

  return (
    <div className="page overview">
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`${greeting(hour)}${name ? `, ${name}` : ''}!`}
        subtitle={<StudySummary {...summary} total={progress.total} />}
        actions={
          <button type="button" className="button button--primary" onClick={() => openNewActivity()}>
            <Plus size={18} aria-hidden />
            Nova atividade
          </button>
        }
      />

      <div className="stats" data-testid="stats">
        <StatCard
          label="Pendentes"
          value={summary.pending.length}
          icon={ListTodo}
          tone="brand"
          href={paths.activities({ ver: 'pendentes' })}
        />
        <StatCard
          label="Atrasadas"
          value={summary.overdue.length}
          icon={TriangleAlert}
          tone="atrasada"
          href={paths.activities({ ver: 'atrasadas' })}
        />
        <StatCard
          label="Prazo próximo"
          hint="até 5 dias"
          value={summary.dueSoon.length}
          icon={Clock}
          tone="urgente"
          href={paths.activities({ ver: 'prazo_proximo' })}
        />
        <StatCard
          label="Concluídas"
          value={summary.completed}
          icon={CircleCheckBig}
          tone="concluida"
          href={paths.completed}
        />
      </div>

      <div className="overview__grid">
        <div className="overview__main">
          <Section
            title="Precisa da minha atenção"
            icon={TriangleAlert}
            className="section--attention"
            description="Atividades atrasadas e com prazo nos próximos 5 dias."
            link={
              summary.attention.length > ATTENTION_LIMIT
                ? { href: paths.activities({ ver: 'pendentes' }), label: 'Ver todas' }
                : undefined
            }
          >
            {summary.attention.length > 0 ? (
              <ActivityList activities={summary.attention.slice(0, ATTENTION_LIMIT)} label="Precisa da minha atenção" />
            ) : (
              <EmptyState
                icon={PartyPopper}
                tone="success"
                title="Tudo em dia!"
                description={
                  progress.total === 0
                    ? 'Cadastre suas atividades para acompanhar os prazos por aqui.'
                    : 'Nenhuma atividade atrasada ou vencendo nos próximos 5 dias.'
                }
              />
            )}
          </Section>

          <Section
            title="Próximas atividades"
            icon={CalendarClock}
            className="section--upcoming"
            description="Demais pendências, da mais próxima para a mais distante."
            link={{ href: paths.activities({ ver: 'pendentes' }), label: 'Ver todas' }}
          >
            {summary.upcoming.length > 0 ? (
              <ActivityList activities={summary.upcoming.slice(0, UPCOMING_LIMIT)} label="Próximas atividades" />
            ) : (
              <EmptyState
                icon={Sparkles}
                title={summary.pending.length > 0 ? 'Nada além do que está acima' : 'Nenhuma atividade pendente'}
                description={
                  summary.pending.length > 0
                    ? 'Todas as suas pendências já aparecem em “Precisa da minha atenção”.'
                    : 'Adicione uma nova atividade quando surgir algo para fazer.'
                }
              />
            )}
          </Section>
        </div>

        <aside className="overview__side">
          <section className="card progress-card" aria-labelledby="meu-progresso">
            <header className="progress-card__header">
              <h2 id="meu-progresso" className="section__title">
                Meu progresso
              </h2>
              <BarsMark width={22} className="progress-card__mark" />
            </header>
            <p className="progress-card__percent" data-testid="overall-percent">
              {progress.percent}%
            </p>
            <ProgressBar value={progress.ratio} label="Progresso geral do curso" size="lg" />
            {progress.total > 0 ? (
              <p className="progress-card__caption" data-testid="overall-caption">
                {progress.completed} de {progress.total} atividades concluídas
                {progress.ratio % 1 !== 0 && <> ({formatPercent(progress.ratio)})</>}
              </p>
            ) : (
              <p className="progress-card__caption">
                Nenhuma atividade cadastrada.{' '}
                <button type="button" className="link-button" onClick={() => openNewActivity()}>
                  Cadastre sua primeira atividade
                </button>{' '}
                para acompanhar o progresso.
              </p>
            )}

            {data.disciplines.length > 0 && (
              <ul className="progress-card__list">
                {data.disciplines.map((d) => {
                  const p = computeProgress(data.activities.filter((a) => a.disciplineId === d.id));
                  return (
                    <li key={d.id}>
                      <a href={paths.discipline(d.id)} className="progress-card__row">
                        <span className="progress-card__name">{d.name}</span>
                        <span className="progress-card__value">
                          {p.completed}/{p.total} · {p.percent}%
                        </span>
                      </a>
                      <ProgressBar value={p.ratio} label={`Progresso de ${d.name}`} size="sm" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card legend" aria-labelledby="legenda-cores">
            <h2 id="legenda-cores" className="legend__title">
              Legenda de prazos
            </h2>
            <ul className="legend__list">
              <li><span className="dot dot--atrasada" /> Atrasada</li>
              <li><span className="dot dot--urgente" /> Urgente · 0 a 2 dias</li>
              <li><span className="dot dot--atencao" /> Atenção · 3 a 5 dias</li>
              <li><span className="dot dot--no_prazo" /> No prazo · mais de 5 dias</li>
              <li><span className="dot dot--concluida" /> Concluída</li>
            </ul>
          </section>
        </aside>
      </div>

      <section className="overview__disciplines" aria-labelledby="disciplinas-titulo">
        <header className="section__header section__header--bare">
          <h2 id="disciplinas-titulo" className="section__title">
            <BookOpen size={18} className="section__icon" aria-hidden />
            Disciplinas
          </h2>
          <button type="button" className="button button--secondary button--sm" onClick={openNewDiscipline}>
            <Plus size={16} aria-hidden />
            Nova disciplina
          </button>
        </header>
        {data.disciplines.length > 0 ? (
          <div className="discipline-grid">
            {data.disciplines.map((d) => (
              <DisciplineCard
                key={d.id}
                discipline={d}
                activities={data.activities.filter((a) => a.disciplineId === d.id)}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={BookOpen}
              title="Nenhuma disciplina cadastrada"
              description="Comece criando uma disciplina. Depois, adicione as atividades dela."
              action={
                <button type="button" className="button button--primary" onClick={openNewDiscipline}>
                  Criar disciplina
                </button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

function StudySummary({
  pending,
  overdue,
  dueSoon,
  completed,
  total,
}: {
  pending: unknown[];
  overdue: unknown[];
  dueSoon: unknown[];
  completed: number;
  total: number;
}) {
  if (total === 0) return <>Você ainda não tem atividades cadastradas. Que tal começar agora?</>;
  if (pending.length === 0) return <>Parabéns! Você concluiu todas as {total} atividades cadastradas.</>;

  const parts: string[] = [`Você concluiu ${completed} de ${total} atividades`];
  if (overdue.length > 0) {
    parts.push(overdue.length === 1 ? '1 está atrasada' : `${overdue.length} estão atrasadas`);
  }
  if (dueSoon.length > 0) {
    parts.push(dueSoon.length === 1 ? '1 vence nos próximos dias' : `${dueSoon.length} vencem nos próximos dias`);
  }
  if (overdue.length === 0 && dueSoon.length === 0) parts.push('nenhum prazo apertado por enquanto');
  return <>{parts.join(' · ')}.</>;
}

function StatCard({
  label,
  hint,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  hint?: string;
  value: number;
  icon: typeof ListTodo;
  tone: 'brand' | 'atrasada' | 'urgente' | 'concluida';
  href: string;
}) {
  return (
    <a className={`card stat stat--${tone}${value > 0 ? ' has-value' : ''}`} href={href} data-testid={`stat-${tone}`}>
      <span className="stat__icon">
        <Icon size={20} aria-hidden />
      </span>
      <span className="stat__body">
        <span className="stat__value">{value}</span>
        <span className="stat__label">
          {label}
          {hint && <small> · {hint}</small>}
        </span>
      </span>
    </a>
  );
}
