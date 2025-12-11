import React from 'react';
import { cn } from './utils';

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, actions, children, className, padded = true }) => {
  return (
    <div className={cn('ui-card', className, { 'ui-card-padded': padded })}>
      {(title || subtitle || actions) && (
        <div className="ui-card-header">
          <div>
            {title ? <div className="ui-card-title">{title}</div> : null}
            {subtitle ? <div className="ui-card-subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="ui-card-actions">{actions}</div> : null}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  );
};

export default Card;
