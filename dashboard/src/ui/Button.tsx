import React from 'react';
import { cn } from './utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}) => {
  return (
    <button
      className={cn(
        'ui-btn',
        `ui-btn-${variant}`,
        `ui-btn-${size}`,
        { 'ui-btn-full': fullWidth },
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
