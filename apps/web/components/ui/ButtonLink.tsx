import type { AnchorHTMLAttributes } from 'react';

// Authentication destinations use ordinary navigation through the existing API gateway.
export function ButtonLink({ variant = 'primary', className = '', ...props }:
  AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: 'primary' | 'secondary' | 'text' }) {
  return <a {...props} className={`button uce-button--${variant} ${className}`} />;
}
