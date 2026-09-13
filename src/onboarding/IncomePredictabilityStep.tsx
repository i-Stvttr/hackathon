import { useState } from "react";

const PREDICTABILITY = [
  { id: "same",     label: "About the same regularly" },
  { id: "somewhat", label: "Changes somewhat month to month" },
  { id: "alot",     label: "Changes a lot month to month" },
  { id: "project",  label: "Mostly project-based" },
  { id: "unsure",   label: "I'm not sure yet" },
];

const RECURRING = [
  { id: "several",   label: "Yes, several" },
  { id: "one_two",   label: "Yes, one or two" },
  { id: "onetime",   label: "No, mostly one-time work" },
  { id: "unsure",    label: "Not sure" },
];

interface Props {
  onNext: (data: { predictability: string; recurring: string }) => void;
  onBack: () => void;
}

function OptionRow({
  label,
  selected,
  onClick,
  radio = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  radio?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-secondary)]"
          : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-secondary)]"
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
        selected ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
      }`}>
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] block"/>}
      </span>
      <span className={`text-sm flex-1 ${selected ? "font-medium text-[var(--color-primary)]" : "text-[var(--color-foreground)]"}`}>
        {label}
      </span>
    </button>
  );
}

export default function IncomePredictabilityStep({ onNext, onBack }: Props) {
  const [predictability, setPredictability] = useState<string | null>(null);
  const [recurring, setRecurring]           = useState<string | null>(null);

  const canContinue = predictability && recurring;

  return (
    <div className="flex flex-col min-h-full px-6 pt-8 pb-10">
      <div className="mb-8">
        <h1 style={{ fontFamily: "var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2 leading-snug">
          How predictable is your income?
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          This helps CapiFrog plan around your cash flow rhythm.
        </p>
      </div>

      <div className="flex-1 space-y-8">
        {/* Q1 */}
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)] mb-3" style={{ letterSpacing: "0.1em" }}>
            What does your income usually look like?
          </p>
          <div className="space-y-2">
            {PREDICTABILITY.map((opt) => (
              <OptionRow
                key={opt.id}
                label={opt.label}
                selected={predictability === opt.id}
                onClick={() => setPredictability(opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Soft divider */}
        <div className="h-px bg-[var(--color-border)]"/>

        {/* Q2 */}
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)] mb-3" style={{ letterSpacing: "0.1em" }}>
            Do you have recurring clients or income sources?
          </p>
          <div className="space-y-2">
            {RECURRING.map((opt) => (
              <OptionRow
                key={opt.id}
                label={opt.label}
                selected={recurring === opt.id}
                onClick={() => setRecurring(opt.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="flex-none border border-[var(--color-border)] text-[var(--color-muted-foreground)] rounded-2xl px-5 py-4 text-sm font-medium"
        >
          Back
        </button>
        <button
          onClick={() => canContinue && onNext({ predictability: predictability!, recurring: recurring! })}
          disabled={!canContinue}
          className="flex-1 bg-[var(--color-primary)] text-white rounded-2xl py-4 text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
