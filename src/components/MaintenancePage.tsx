import React from 'react';
import {
  Wrench,
  ShieldAlert,
  Clock,
  Lock,
  AlertTriangle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { EngineeringBackground } from './EngineeringBackground';

export function MaintenancePage() {
  const handleCheckStatus = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
      {/* Dynamic Grid Background */}
      <EngineeringBackground />

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
              <FileText size={17} strokeWidth={2.2} />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                Document Generator
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                Maintenance Mode
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-700 dark:text-amber-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Offline</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-10 text-center transition-all">
          {/* Animated Maintenance Icon Badge */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-6">
            <div className="absolute inset-0 rounded-3xl bg-amber-500/20 dark:bg-amber-500/10 blur-xl animate-pulse" />
            <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
              <Wrench size={38} className="sm:w-11 sm:h-11 animate-bounce" style={{ animationDuration: '2.5s' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 dark:bg-red-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-xs">
              <Lock size={15} strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-3 tracking-wide uppercase">
            <AlertTriangle size={13} className="shrink-0" />
            Scheduled Maintenance in Progress
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Website Under Maintenance
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto mb-8">
            We are performing essential system updates and maintenance. All document generation, upload, and conversion services are temporarily suspended.
          </p>

          {/* 3 Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <Clock size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Access</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Temporarily Blocked
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                No user access allowed
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Lock size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Services</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Offline for Upgrades
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pipelines paused
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <ShieldAlert size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Integrity</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Data Protected
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Safe & secured
              </p>
            </div>
          </div>

          {/* Detailed Alert Message */}
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-200/90 text-left mb-6 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Access Restriction Notice</p>
              <p className="text-amber-800/80 dark:text-amber-300/80 leading-normal">
                To prevent incomplete processing or system conflicts during upgrades, all upload channels, document merging, and cloud conversion APIs are strictly locked. Please check back later.
              </p>
            </div>
          </div>

          {/* Refresh / Check Button */}
          <button
            type="button"
            onClick={handleCheckStatus}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Check If System Is Back Online</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md py-3 transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500 text-center sm:text-left">
          <span>Document Generator — System Maintenance Mode</span>
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            All public access temporarily disabled
          </span>
        </div>
      </footer>
    </div>
  );
}
