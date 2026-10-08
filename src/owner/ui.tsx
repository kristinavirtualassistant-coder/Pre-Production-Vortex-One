import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { OwnerApiError, ownerGet } from './api';
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react';

export const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
export const formatNumber = (n?: number | null) => (n == null ? '—' : new Intl.NumberFormat().format(n));
export function formatBytes(bytes?: number | null) {
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  red: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
};
export function Badge({ tone = 'slate', children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone] || TONES.slate}`}>{children}</span>;
}
export const statusTone = (s?: string) => ({ active: 'green', success: 'green', ok: 'green', implemented: 'green', suspended: 'amber', denied: 'amber', planned: 'cyan', running: 'cyan',
  deactivated: 'red', failure: 'red', error: 'red', degraded: 'red' } as Record<string, string>)[s || ''] || 'slate';

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}>
      {(title || action) && <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><h2 className="text-sm font-semibold text-slate-200">{title}</h2>{action}</header>}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{label}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1"><p>{message}</p>{onRetry && <button onClick={onRetry} className="mt-2 rounded-md bg-rose-500/20 px-2 py-1 text-xs font-medium hover:bg-rose-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">Try again</button>}</div>
    </div>
  );
}
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="flex flex-col items-center gap-2 py-10 text-center"><Inbox className="h-6 w-6 text-slate-600" aria-hidden /><p className="text-sm font-medium text-slate-300">{title}</p>{hint && <p className="max-w-md text-xs text-slate-500">{hint}</p>}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-white">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export const inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40';
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';
export const dangerButton = 'inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300';

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs font-medium text-slate-300">{label}</label>{children(id)}{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>;
}

/** Accessible modal: role=dialog, labelled, Escape closes, focus moves in and returns on close. */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Table({ headers, children, caption }: { headers: string[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-900"><tr>{headers.map((h) => <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/40">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`px-3 py-2 align-middle text-slate-200 ${className}`}>{children}</td>;


/** Loads a GET endpoint with loading/error/reload state. */
export function useOwnerData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError(null);
    try { setData(await ownerGet<T>(path)); } catch (e) { setError(e instanceof OwnerApiError ? e.message : 'Something went wrong.'); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}
