import { useId, type ReactNode } from 'react';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return <section className="panel uce-card" aria-labelledby={titleId}><h2 id={titleId}>{title}</h2>{children}</section>;
}
