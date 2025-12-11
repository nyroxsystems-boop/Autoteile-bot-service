import React from 'react';
import { cn } from './utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string | null;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  fullWidth,
  className,
  id,
  ...rest
}) => {
  const inputId = id || rest.name || undefined;

  return (
    <div className={cn('ui-input-group', className, { 'ui-input-full': fullWidth })}>
      {label ? (
        <label className="ui-input-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn('ui-input', { 'ui-input-error': !!error })}
        {...rest}
      />
      {helperText && !error ? <div className="ui-input-helper">{helperText}</div> : null}
      {error ? <div className="ui-input-error-text">{error}</div> : null}
    </div>
  );
};

export default Input;
