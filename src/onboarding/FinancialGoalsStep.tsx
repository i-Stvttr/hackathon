import { useState } from "react";

const GOALS = [
  {
    id: "emergency",
    label: "Build an emergency fund",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1.5L2.5 5v5c0 4 2.9 7 6.5 7.5C12.6 17 15.5 14 15.5 10V5L9 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M6.5 9l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "credit",
    label: "Improve credit readiness",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2 8.5h14" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="5.5" cy="12" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "save",
    label: "Save more consistently",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 12l3.5-4 3 3 5-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 15.5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "irregular",
    label: "Handle irregular income better",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2.5 9h3l2-5 3 9 2-6 2 2h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "slow",
    label: "Prepare for slow-income months",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 5.5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "shortterm",
    label: "Save for a short-term goal",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2l1.6 4.6H15l-3.8 2.8 1.5 4.6L9 11.2l-3.7 2.8 1.5-4.6L3 6.6h4.4L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const MAX_SELECTIONS = 2;

interface Props {
  onComplete: (data: { goals: string[] }) => void;
  onBack: () => void;
}

export default function FinancialGoalsStep({ onComplete, onBack }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  }

  const remaining = MAX_SELECTIONS - selected.length;

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-10">
      <div className="mb-2">
        <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2 leading-snug">
          What would you like to strengthen?
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          Choose up to two priorities. CapiFrog will focus on these first.
        </p>
      </div>

      {/* Selection counter */}
      <div className="flex items-center gap-1.5 mb-6 mt-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: 28,
              backgroundColor: i < selected.length ? "var(--color-primary)" : "var(--color-border)",
            }}
          />
        ))}
        <p className="text-[11px] text-[var(--color-muted-foreground)] ml-1">
          {remaining === 0 ? "Selections complete" : `${remaining} more`}
        </p>
      </div>

      <div className="space-y-2.5 flex-1">
        {GOALS.map((goal) => {
          const on      = selected.includes(goal.id);
          const maxed   = !on && selected.length >= MAX_SELECTIONS;
          return (
            <button
              key={goal.id}
              onClick={() => toggle(goal.id)}
              disabled={maxed}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                on
                  ? "border-[var(--color-primary)] bg-[var(--color-secondary)]"
                  : maxed
                  ? "border-[var(--color-border)] bg-white opacity-40 cursor-not-allowed"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-secondary)]"
              }`}
            >
              <span className={`shrink-0 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-muted-foreground)]"}`}>
                {goal.icon}
              </span>
              <span className={`text-sm font-medium flex-1 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-foreground)]"}`}>
                {goal.label}
              </span>
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                on ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
              }`}>
                {on && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="flex-none border border-[var(--color-border)] text-[var(--color-muted-foreground)] rounded-2xl px-5 py-4 text-sm font-medium"
        >
          Back
        </button>
        <button
          onClick={() => selected.length > 0 && onComplete({ goals: selected })}
          disabled={selected.length === 0}
          className="flex-1 bg-[var(--color-primary)] text-white rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}
