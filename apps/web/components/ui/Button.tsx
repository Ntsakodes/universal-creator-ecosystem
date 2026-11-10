import type { ButtonHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text' }) {
  return <button {...props} type={type} className={`uce-button uce-button--${variant} ${className}`} />;
}
