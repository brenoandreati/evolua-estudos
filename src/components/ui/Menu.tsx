import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { EllipsisVertical } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  onSelect: () => void;
  tone?: 'danger';
}

/** Menu de ações compacto (botão "⋮"). */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.menu__trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    rootRef.current?.querySelector<HTMLButtonElement>('.menu__item')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="icon-button menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisVertical size={18} aria-hidden />
      </button>
      {open && (
        <div className="menu__list" role="menu" id={menuId}>
          {items.map(({ label: itemLabel, icon: Icon, onSelect, tone }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              className={`menu__item${tone ? ` menu__item--${tone}` : ''}`}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
            >
              <Icon size={16} aria-hidden />
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
