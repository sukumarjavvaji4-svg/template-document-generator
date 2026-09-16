import React from 'react';

export function EngineeringBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0"
      aria-hidden="true"
    >
      {/* ─── Layer 1: Atmospheric Ambient Glows ─────────────────────────────── */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#070b14] transition-colors duration-500" />

      {/* Top Center Ambient Blueprint Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-600/15 dark:via-indigo-600/5 dark:to-transparent blur-3xl opacity-70 animate-ambient-pulse" />

      {/* Bottom Right Subtle Violet Atmospheric Glow */}
      <div className="absolute -bottom-24 -right-24 w-[600px] h-[600px] bg-gradient-to-tl from-purple-500/5 via-indigo-500/5 to-transparent dark:from-purple-900/15 dark:via-indigo-900/10 dark:to-transparent blur-3xl opacity-60" />

      {/* Bottom Left Faint Cyan Accent Glow */}
      <div className="absolute bottom-10 -left-20 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/5 via-blue-500/5 to-transparent dark:from-cyan-900/10 dark:via-blue-900/10 dark:to-transparent blur-3xl opacity-50" />

      {/* ─── Layer 2: Precision Engineering Blueprint Grid ─────────────────── */}
      <svg
        className="absolute inset-0 w-full h-full opacity-60 dark:opacity-40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Minor Grid: 24px */}
          <pattern
            id="blueprint-minor"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-slate-300/40 dark:text-sky-400/[0.08]"
            />
          </pattern>

          {/* Major Grid: 120px with Crosshairs */}
          <pattern
            id="blueprint-major"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <rect width="120" height="120" fill="url(#blueprint-minor)" />
            {/* Major boundary lines */}
            <path
              d="M 120 0 L 0 0 0 120"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-400/35 dark:text-sky-400/[0.16]"
            />
            {/* Center crosshair '+' at grid intersection */}
            <path
              d="M 0 4 L 0 -4 M -4 0 L 4 0 M 120 4 L 120 -4 M 116 0 L 124 0 M 0 124 L 0 116 M -4 120 L 4 120"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-blue-500/40 dark:text-sky-300/[0.3]"
            />
          </pattern>

          {/* Radial vignette mask to fade grid smoothly at window perimeters */}
          <mask id="grid-vignette">
            <radialGradient id="vignette-grad" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
            </radialGradient>
            <rect width="100%" height="100%" fill="url(#vignette-grad)" />
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#blueprint-major)"
          mask="url(#grid-vignette)"
        />
      </svg>

      {/* ─── Layer 3: Left Technical Drafting Scale (Ruler & Dimensions) ──── */}
      <div className="hidden lg:block absolute left-4 top-28 bottom-20 w-12 text-slate-400/50 dark:text-slate-500/40 font-mono text-[9px]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Vertical axis line */}
          <line
            x1="20"
            y1="10"
            x2="20"
            y2="700"
            stroke="currentColor"
            strokeWidth="1"
            className="text-slate-300 dark:text-slate-700/60"
          />

          {/* Precision millimeter ticks and labels */}
          {[
            { y: 20, label: '000' },
            { y: 80, label: '050' },
            { y: 140, label: '100' },
            { y: 200, label: '150' },
            { y: 260, label: '200' },
            { y: 320, label: '250' },
            { y: 380, label: '297' }, // A4 standard height
            { y: 460, label: '350' },
            { y: 540, label: '400' },
            { y: 620, label: '450' },
          ].map((tick) => (
            <g key={tick.y} transform={`translate(0, ${tick.y})`}>
              <line
                x1="12"
                y1="0"
                x2="20"
                y2="0"
                stroke="currentColor"
                strokeWidth="1"
                className="text-slate-400/80 dark:text-slate-600"
              />
              <line
                x1="16"
                y1="15"
                x2="20"
                y2="15"
                stroke="currentColor"
                strokeWidth="0.75"
                className="text-slate-300 dark:text-slate-700"
              />
              <line
                x1="14"
                y1="30"
                x2="20"
                y2="30"
                stroke="currentColor"
                strokeWidth="0.75"
                className="text-slate-300 dark:text-slate-700"
              />
              <line
                x1="16"
                y1="45"
                x2="20"
                y2="45"
                stroke="currentColor"
                strokeWidth="0.75"
                className="text-slate-300 dark:text-slate-700"
              />
              <text
                x="8"
                y="3"
                textAnchor="end"
                fill="currentColor"
                className="text-slate-400/60 dark:text-slate-600/80 text-[8px]"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Vertical Technical Stamp */}
          <text
            x="-260"
            y="32"
            transform="rotate(-90)"
            fill="currentColor"
            className="text-[9px] tracking-[0.2em] uppercase font-mono text-slate-400/40 dark:text-slate-600/50"
          >
            ISO 216 STANDARD A4 [210 × 297 MM]
          </text>
        </svg>
      </div>

      {/* ─── Layer 4: Top-Right Document Outline & Isometric Paper Motif ───── */}
      <div className="hidden xl:block absolute top-20 right-8 w-72 h-80 animate-blueprint-drift opacity-60 dark:opacity-40">
        <svg viewBox="0 0 280 320" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Faint technical angle arc */}
          <path
            d="M 190 40 A 120 120 0 0 0 70 160"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeDasharray="3 3"
            className="text-blue-400/40 dark:text-blue-500/25"
          />
          <text x="145" y="65" fill="currentColor" className="text-[8px] font-mono text-blue-500/50 dark:text-blue-400/40">
            ∠ 45.0°
          </text>

          {/* Back Sheet Outline */}
          <rect
            x="70"
            y="40"
            width="140"
            height="198"
            rx="4"
            transform="rotate(6 140 139)"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="text-slate-400/50 dark:text-slate-600/50"
          />

          {/* Front Sheet Outline (A4 Proportions: 140x198) */}
          <g transform="rotate(-3 130 145)">
            <rect
              x="50"
              y="50"
              width="140"
              height="198"
              rx="4"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-blue-500/60 dark:text-sky-400/40"
            />
            {/* Header rule */}
            <line
              x1="62"
              y1="68"
              x2="178"
              y2="68"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-blue-500/40 dark:text-sky-400/30"
            />
            <rect x="62" y="58" width="28" height="5" rx="1" fill="currentColor" className="text-blue-500/20 dark:text-sky-400/20" />

            {/* Document body wireframe lines */}
            <line x1="62" y1="82" x2="178" y2="82" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/80 dark:text-slate-700/60" />
            <line x1="62" y1="92" x2="160" y2="92" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/80 dark:text-slate-700/60" />
            <line x1="62" y1="102" x2="170" y2="102" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/80 dark:text-slate-700/60" />
            <line x1="62" y1="112" x2="140" y2="112" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/80 dark:text-slate-700/60" />

            {/* Simulated table grid */}
            <rect
              x="62"
              y="126"
              width="116"
              height="50"
              rx="2"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-blue-400/40 dark:text-sky-500/30"
            />
            <line x1="62" y1="138" x2="178" y2="138" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/30 dark:text-sky-500/20" />
            <line x1="100" y1="126" x2="100" y2="176" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/30 dark:text-sky-500/20" />
            <line x1="140" y1="126" x2="140" y2="176" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/30 dark:text-sky-500/20" />

            {/* Dimension extension lines */}
            <line x1="42" y1="50" x2="42" y2="248" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <line x1="38" y1="50" x2="46" y2="50" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <line x1="38" y1="248" x2="46" y2="248" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <text x="34" y="152" textAnchor="middle" transform="rotate(-90 34 152)" fill="currentColor" className="text-[8px] font-mono text-slate-400/70 dark:text-slate-500">
              297 mm
            </text>

            <line x1="50" y1="258" x2="190" y2="258" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <line x1="50" y1="254" x2="50" y2="262" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <line x1="190" y1="254" x2="190" y2="262" stroke="currentColor" strokeWidth="0.75" className="text-slate-400/60 dark:text-slate-600" />
            <text x="120" y="270" textAnchor="middle" fill="currentColor" className="text-[8px] font-mono text-slate-400/70 dark:text-slate-500">
              210 mm
            </text>
          </g>

          {/* Drafting Crosshair Target */}
          <circle cx="230" cy="80" r="12" stroke="currentColor" strokeWidth="0.75" className="text-blue-500/50 dark:text-sky-400/35" />
          <circle cx="230" cy="80" r="4" fill="currentColor" className="text-blue-500/30 dark:text-sky-400/20" />
          <line x1="214" y1="80" x2="246" y2="80" stroke="currentColor" strokeWidth="0.75" className="text-blue-500/50 dark:text-sky-400/35" />
          <line x1="230" y1="64" x2="230" y2="96" stroke="currentColor" strokeWidth="0.75" className="text-blue-500/50 dark:text-sky-400/35" />
        </svg>
      </div>

      {/* ─── Layer 5: Bottom-Left Technical Node Schematic ─────────────────── */}
      <div className="hidden lg:block absolute bottom-8 left-8 w-64 h-56 opacity-55 dark:opacity-35">
        <svg viewBox="0 0 240 200" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Engineering Node Path */}
          <path
            d="M 20 160 L 60 160 L 90 120 L 150 120 L 180 70 L 220 70"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-slate-400/60 dark:text-slate-600/70"
          />
          <path
            d="M 90 120 L 120 160 L 170 160"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeDasharray="3 3"
            className="text-indigo-400/50 dark:text-indigo-500/40"
          />

          {/* Precision Nodes */}
          <circle cx="20" cy="160" r="4" stroke="currentColor" strokeWidth="1.5" className="text-blue-600 dark:text-blue-400 fill-white dark:fill-slate-900" />
          <circle cx="60" cy="160" r="3" fill="currentColor" className="text-blue-500/60 dark:text-blue-400/60" />
          <circle cx="90" cy="120" r="4" stroke="currentColor" strokeWidth="1.5" className="text-indigo-600 dark:text-indigo-400 fill-white dark:fill-slate-900" />
          <circle cx="150" cy="120" r="3" fill="currentColor" className="text-indigo-500/60 dark:text-indigo-400/60" />
          <circle cx="180" cy="70" r="4" stroke="currentColor" strokeWidth="1.5" className="text-cyan-600 dark:text-cyan-400 fill-white dark:fill-slate-900" />
          <circle cx="220" cy="70" r="3" fill="currentColor" className="text-cyan-500/60 dark:text-cyan-400/60" />

          {/* Technical labels */}
          <text x="20" y="180" fill="currentColor" className="text-[8px] font-mono text-slate-400/70 dark:text-slate-500">
            N.01 [LAYOUT]
          </text>
          <text x="90" y="105" fill="currentColor" className="text-[8px] font-mono text-slate-400/70 dark:text-slate-500">
            N.02 [OOXML]
          </text>
          <text x="180" y="55" fill="currentColor" className="text-[8px] font-mono text-slate-400/70 dark:text-slate-500">
            N.03 [OUTPUT]
          </text>
          <text x="120" y="176" fill="currentColor" className="text-[7px] font-mono text-indigo-400/60 dark:text-indigo-400/50">
            VERIFY_SECTPR()
          </text>
        </svg>
      </div>

      {/* ─── Layer 6: Bottom-Right Concentric Compass Arcs ─────────────────── */}
      <div className="hidden md:block absolute -bottom-16 -right-16 w-80 h-80 opacity-50 dark:opacity-35">
        <svg viewBox="0 0 300 300" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Concentric compass circles */}
          <circle cx="220" cy="220" r="60" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/70 dark:text-slate-700/60" />
          <circle cx="220" cy="220" r="100" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 4" className="text-blue-400/40 dark:text-blue-500/30" />
          <circle cx="220" cy="220" r="140" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/50 dark:text-slate-800/60" />
          <circle cx="220" cy="220" r="180" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" className="text-indigo-400/40 dark:text-indigo-500/25" />

          {/* Radial degree rays */}
          <line x1="220" y1="220" x2="80" y2="140" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/60 dark:text-slate-700/50" />
          <line x1="220" y1="220" x2="100" y2="80" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/60 dark:text-slate-700/50" />
          <line x1="220" y1="220" x2="140" y2="40" stroke="currentColor" strokeWidth="0.75" className="text-slate-300/60 dark:text-slate-700/50" />

          {/* Radial tick text */}
          <text x="90" y="130" fill="currentColor" className="text-[8px] font-mono text-slate-400/60 dark:text-slate-600">
            R=140.0MM
          </text>
          <text x="145" y="32" fill="currentColor" className="text-[8px] font-mono text-slate-400/60 dark:text-slate-600">
            θ=60°
          </text>
        </svg>
      </div>

      {/* ─── Layer 7: Corner Engineering Registration Marks ───────────────── */}
      <div className="absolute top-16 left-6 w-4 h-4 border-t-2 border-l-2 border-slate-300/70 dark:border-slate-700/60" />
      <div className="absolute top-16 right-6 w-4 h-4 border-t-2 border-r-2 border-slate-300/70 dark:border-slate-700/60" />
      <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-slate-300/70 dark:border-slate-700/60" />
      <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-slate-300/70 dark:border-slate-700/60" />
    </div>
  );
}
