import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl border
                 transition-all duration-250 ease-in-out shadow-sm text-xs font-semibold select-none cursor-pointer
                 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200
                 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700
                 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:scale-95"
    >
      {/* Icon Morph Container */}
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {/* Sun Icon (Visible in Dark mode to switch to Light mode) */}
        <Sun
          size={15}
          className={`absolute text-amber-400 fill-amber-400/20 transition-all duration-250 ease-in-out transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-75 pointer-events-none'
          }`}
          strokeWidth={2}
        />
        {/* Moon Icon (Visible in Light mode to switch to Dark mode) */}
        <Moon
          size={15}
          className={`absolute text-indigo-600 dark:text-indigo-400 fill-indigo-600/10 transition-all duration-250 ease-in-out transform ${
            !isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 rotate-90 scale-75 pointer-events-none'
          }`}
          strokeWidth={2}
        />
      </div>

      {/* Label Text with smooth crossfade */}
      <span className="hidden sm:inline-block relative h-4 w-9 text-left overflow-hidden">
        <span
          className={`absolute inset-0 flex items-center transition-all duration-250 ease-in-out ${
            isDark ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          Light
        </span>
        <span
          className={`absolute inset-0 flex items-center transition-all duration-250 ease-in-out ${
            !isDark ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          Dark
        </span>
      </span>
    </button>
  );
}
