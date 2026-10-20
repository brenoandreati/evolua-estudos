import { cloneElement } from 'react';
import type { ReactElement } from 'react';

type ControlElement = ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;

/** Campo de formulário com rótulo, dica e mensagem de erro acessíveis. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ControlElement;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__required" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(children, { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
