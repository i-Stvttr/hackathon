import { useState } from "react";

const OPTIONS = [
  {
    id: "bank",
    label: "Connect bank account",
    description: "Securely analyze deposits, transactions, and cash flow.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 8h16M4 8V5.5L10 3l6 2.5V8M5 8v7M10 8v7M15 8v7M2 15h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "documents",
    label: "Upload income documents",
    description: "Provide invoices or other income documentation.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 11V8M8.5 9.5L10 8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 14h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "manual",
    label: "Enter income manually",
    description: "Enter approximate monthly income manually.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M3 10h10M3 15h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="16" cy="15" r="3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M16 13.5v1.5l1 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

interface Props {
  onNext: (data: { method: string }) => void;
  onBack: () => void;
}

export default function IncomeConnectionStep({ onNext, onBack }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-10">
      <div className="mb-8">
        <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2 leading-snug">
          Show us how you earn
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          Connect your financial information so we can understand your cash flow.
        </p>
      </div>

      <div className="space-y-3 mb-6 flex-1">
        {OPTIONS.map((opt) => {
          const on = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`w-full flex items-start gap-4 px-4 py-4 rounded-2xl border text-left transition-all ${
                on
                  ? "border-[var(--color-primary)] bg-[var(--color-secondary)]"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-secondary)]"
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-muted-foreground)]"}`}>
                {opt.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold mb-0.5 ${on ? "text-[var(--color-primary)]" : "text-[var(--color-foreground)]"}`}>
                  {opt.label}
                </span>
                <span className="block text-xs text-[var(--color-muted-foreground)] leading-relaxed">
                  {opt.description}
                </span>
              </span>
              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                on ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
              }`}>
                {on && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] block"/>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-[#e6f7f5] border border-[#b3e5de] px-4 py-3.5 mb-6">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#2a9d8f] shrink-0 mt-0.5">
          <path d="M7 1.5L2 4v4c0 2.8 2.1 5.1 5 5.6C10 13.1 12 10.8 12 8V4L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M5 7l1.5 1.5L9 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[11px] text-[#2a9d8f] leading-relaxed">
          Your financial information is encrypted and used only to evaluate your financial profile. We never share or sell your data.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-none border border-[var(--color-border)] text-[var(--color-muted-foreground)] rounded-2xl px-5 py-4 text-sm font-medium"
        >
          Back
        </button>
        <button
          onClick={() => selected && onNext({ method: selected })}
          disabled={!selected}
          className="flex-1 bg-[var(--color-primary)] text-white rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          Continue securely
        </button>
      </div>
    </div>
  );
}
