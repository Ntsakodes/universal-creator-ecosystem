'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

export function AppShell<T extends string>({ items, active, onNavigate, account, children }:
  { items: readonly T[]; active: T; onNavigate: (item: T) => void; account: ReactNode; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const content = useRef<HTMLElement>(null);
  return <div className="app-shell uce-shell">
    <a href="#workspace-content" className="skip-link">Skip to workspace</a>
    <aside className="sidebar">
      <Link className="wordmark" href="/">UCE<span>Universal Creator Ecosystem</span></Link>
      <button className="uce-menu secondary" aria-expanded={expanded} aria-controls="workspace-navigation"
        onClick={() => setExpanded(!expanded)}>{expanded ? 'Close navigation' : 'Open navigation'}</button>
      <nav id="workspace-navigation" aria-label="Workspace" className={expanded ? 'is-expanded' : ''}>
        {items.map((item, index) => <button key={item} type="button"
          className={active === item ? 'nav-item active' : 'nav-item'} aria-current={active === item ? 'page' : undefined}
          onClick={() => { onNavigate(item); setExpanded(false); content.current?.focus(); }}>
          <span className="nav-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{item}
        </button>)}
      </nav>
      <div className="sidebar-bottom">{account}</div>
    </aside>
    <main ref={content} id="workspace-content" tabIndex={-1} className="workspace">{children}</main>
  </div>;
}
