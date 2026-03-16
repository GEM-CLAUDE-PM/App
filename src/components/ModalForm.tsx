/**
 * ModalForm.tsx — GEM & CLAUDE PM Pro
 * Reusable modal form wrapper dùng chung cho toàn app.
 * Thay thế tất cả inline form collapse/expand.
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalFormProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'orange' | 'teal' | 'indigo' | 'slate';
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
}

const COLOR_MAP = {
  emerald: { header: 'bg-emerald-600', icon: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  blue:    { header: 'bg-blue-600',    icon: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700'    },
  violet:  { header: 'bg-violet-600',  icon: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700' },
  amber:   { header: 'bg-amber-500',   icon: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700'  },
  rose:    { header: 'bg-rose-600',    icon: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700'    },
  orange:  { header: 'bg-orange-600',  icon: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700'},
  teal:    { header: 'bg-teal-600',    icon: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700'    },
  indigo:  { header: 'bg-indigo-600',  icon: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700'},
  slate:   { header: 'bg-slate-700',   icon: 'bg-slate-600',   badge: 'bg-slate-100 text-slate-700'  },
  red:     { header: 'bg-rose-600',    icon: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700'    },
};

const WIDTH_MAP = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function ModalForm({
  open, onClose, title, subtitle, icon, color = 'emerald',
  width = 'md', children, footer, loading = false,
}: ModalFormProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const c = COLOR_MAP[color] ?? COLOR_MAP['slate'];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`relative w-full ${WIDTH_MAP[width]} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden`}
        style={{ animation: 'modalIn 0.18s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:scale(0.96) translateY(8px); }
            to   { opacity:1; transform:scale(1)    translateY(0);    }
          }
        `}</style>

        {/* Header */}
        <div className={`${c.header} px-5 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`w-9 h-9 ${c.icon} rounded-xl flex items-center justify-center text-white shrink-0`}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
              {subtitle && <p className="text-[11px] text-white/70 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl z-10">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

export function FormRow({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function FormGrid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const cls = cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
  return <div className={`grid ${cls} gap-3`}>{children}</div>;
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">{title}</p>
      {children}
    </div>
  );
}

export const inputCls = "w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder:text-slate-300";
export const selectCls = "w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300";

export function BtnCancel({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold">
      Hủy
    </button>
  );
}

export function BtnSubmit({ onClick, loading, label, color = 'emerald' }: {
  onClick: () => void; loading?: boolean; label: string; color?: string;
}) {
  const bg = color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : color === 'rose' ? 'bg-rose-600 hover:bg-rose-700' : color === 'amber' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700';
  return (
    <button onClick={onClick} disabled={loading} className={`px-5 py-2 text-xs text-white ${bg} rounded-xl font-bold disabled:opacity-50 flex items-center gap-2`}>
      {loading && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
      {label}
    </button>
  );
}
