import { useState } from "react";

const SOURCES = [
  {
    id: "freelance",
    label: "Freelance / independent work",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M6 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M2 8h14" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "professional",
    label: "Professional services",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 15c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "project",
    label: "Project-based work",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "creator",
    label: "Creator / digital income",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7 6.5l5 2.5-5 2.5V6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "gig",
    label: "Gig / platform work",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2l1.8 5H16l-4.3 3.1 1.6 5L9 12.1 5.7 15.1l1.6-5L3 7h5.2L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "other",
    label: "Other variable income",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 6v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

interface Props {
  onNext: (data: { selected: string[]; primary: string | null }) => void;
}

export default function IncomeTypeStep({ onNext }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary]   = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!next.includes(primary ?? "")) setPrimary(next.length === 1 ? next[0] : null);
      return next;
    });
  }

  const multi = selected.length > 1;

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-10">
      <div className="mb-8">
        <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2 leading-snug">
          Tell us how you earn
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          How do you receive most of your income? Select all that apply.
        </p>
      </div>

      <div className="space-y-2.5 mb-6 flex-1">
        {SOURCES.map((src) => {
          const on = selected.includes(src.id);
          return (
            <button
              key={src.id}
              onClick={() => toggle(src.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                on
                  ? "border-[var(--color-primary)] bg-[var(--color-secondary)]"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-secondary)]"
              }`}
            >
              <span className={`shrink-0 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-muted-foreground)]"}`}>
                {src.icon}
              </span>
              <span className={`text-sm font-medium flex-1 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-foreground)]"}`}>
                {src.label}
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

      {/* Primary picker — shows only when multiple selected */}
      {multi && (
        <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-3" style={{ letterSpacing: "0.1em" }}>
            Which is your main income source?
          </p>
          <div className="space-y-2">
            {selected.map((id) => {
              const src = SOURCES.find((s) => s.id === id)!;
              const isPrimary = primary === id;
              return (
                <button
                  key={id}
                  onClick={() => setPrimary(id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    isPrimary
                      ? "border-[var(--color-primary)] bg-white"
                      : "border-[var(--color-border)] bg-white opacity-70"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    isPrimary ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                  }`}>
                    {isPrimary && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] block"/>}
                  </span>
                  <span className="text-sm text-[var(--color-foreground)]">{src.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[var(--color-muted-foreground)] text-center mb-5 leading-relaxed">
        No traditional paycheck? No problem. CapFrog is built to understand variable ways of earning.
      </p>

      <button
        onClick={() => onNext({ selected, primary: multi ? primary : selected[0] ?? null })}
        disabled={selected.length === 0 || (multi && !primary)}
        className="w-full bg-[var(--color-primary)] text-white rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        Continue
      </button>
    </div>
  );
}
