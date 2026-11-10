import type { ReactNode } from 'react';

export function FormField({ label, name, type = 'text', defaultValue = '', required = true, children }:
  { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; children?: ReactNode }) {
  return <label className="field"><span>{label}</span>{children ?
    <select name={name} required={required} defaultValue={defaultValue}>{children}</select> : type === 'textarea' ?
    <textarea name={name} defaultValue={defaultValue} required={required} rows={4} /> :
    <input name={name} type={type} defaultValue={defaultValue} required={required} step={type === 'number' ? '0.01' : undefined} />}</label>;
}
