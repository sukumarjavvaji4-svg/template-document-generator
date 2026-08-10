import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { Toast } from '../types';
import { useToast } from '../context/ToastContext';

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-white',
    border: 'border-l-4 border-l-emerald-500',
    iconColor: 'text-emerald-500',
    titleColor: 'text-slate-800',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-slate-800',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-amber-500',
    iconColor: 'text-amber-500',
    titleColor: 'text-slate-800',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-l-4 border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-slate-800',
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [exiting, setExiting] = useState(false);
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  const handleRemove = () => {
    setExiting(true);
    setTimeout(() => removeToast(toast.id), 250);
  };

  useEffect(() => {
    // pre-exit animation slightly before context removes it
    const timer = setTimeout(() => setExiting(true), 4200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-lg
        ${config.bg} dark:bg-slate-800 ${config.border} border border-slate-100 dark:border-slate-700
        min-w-72 max-w-sm
        transition-all duration-300
        ${exiting ? 'animate-slide-out-right opacity-0' : 'animate-slide-in-right'}
      `}
    >
      <span className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${config.titleColor} dark:text-slate-100`}>
          {toast.message}
        </p>
        {toast.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={handleRemove}
        aria-label="Dismiss notification"
        className="shrink-0 mt-0.5 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      aria-label="Notifications"
      className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
