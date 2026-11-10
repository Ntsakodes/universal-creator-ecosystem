import type { ReactNode } from 'react';

// Labels must describe actual records; a visual tone never implies legal verification.
export function StatusBadge({ children, tone = 'neutral' }:
  { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info' }) {
  return <span className={`badge uce-badge uce-badge--${tone}`}>{children}</span>;
}
