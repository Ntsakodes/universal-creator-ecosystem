import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function LoadingState({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p role="status" aria-live="polite">{children}</p>;
}
export function ErrorState({ children }: { children: ReactNode }) {
  return <div className="alert error" role="alert">{children}</div>;
}
