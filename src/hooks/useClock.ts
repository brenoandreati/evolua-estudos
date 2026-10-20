import { useEffect, useState } from 'react';
import { currentHour, todayISO } from '../domain/dates';
import type { ISODate } from '../domain/types';

interface ClockState {
  today: ISODate;
  hour: number;
}

function readClock(): ClockState {
  const now = new Date();
  return { today: todayISO(now), hour: currentHour(now) };
}

/**
 * Data de hoje (horário de Brasília) e hora atual. Atualiza sozinha a cada
 * minuto e quando a aba volta a ficar visível, então prazos e urgências
 * mudam na virada do dia sem precisar editar nada.
 */
export function useClock(): ClockState {
  const [clock, setClock] = useState<ClockState>(readClock);

  useEffect(() => {
    const refresh = () =>
      setClock((prev) => {
        const next = readClock();
        return next.today === prev.today && next.hour === prev.hour ? prev : next;
      });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return clock;
}
