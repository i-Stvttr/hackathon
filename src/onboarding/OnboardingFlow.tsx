import { useState } from "react";
import capitalOneLogo from "@/imports/image-3.png";
import IncomeTypeStep from "./IncomeTypeStep";
import IncomeConnectionStep from "./IncomeConnectionStep";
import IncomePredictabilityStep from "./IncomePredictabilityStep";
import FinancialGoalsStep from "./FinancialGoalsStep";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingData {
  incomeTypes: { selected: string[]; primary: string | null };
  connectionMethod: { method: string };
  predictability: { predictability: string; recurring: string };
  goals: { goals: string[] };
}

export interface OnboardingFlowProps {
  /** Called when the user completes all four steps. Receives the collected data. */
  onComplete: (data: OnboardingData) => void;
}

const TOTAL_STEPS = 4;

const STEP_TITLES = [
  "Tell us how you earn",
  "Show us how you earn",
  "Understand your income",
  "Your goals",
];

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className="h-0.5 flex-1 rounded-full transition-all duration-300"
          style={{ backgroundColor: i < step ? "var(--color-primary)" : "var(--color-border)" }}
        />
      ))}
    </div>
  );
}

// ─── OnboardingFlow ───────────────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);

  // Collected data across steps
  const [incomeTypes, setIncomeTypes] = useState<OnboardingData["incomeTypes"]>({
    selected: [],
    primary: null,
  });
  const [connectionMethod, setConnectionMethod] = useState<OnboardingData["connectionMethod"]>({
    method: "",
  });
  const [predictability, setPredictability] = useState<OnboardingData["predictability"]>({
    predictability: "",
    recurring: "",
  });

  function handleStep1(data: OnboardingData["incomeTypes"]) {
    setIncomeTypes(data);
    setStep(2);
  }
  function handleStep2(data: OnboardingData["connectionMethod"]) {
    setConnectionMethod(data);
    setStep(3);
  }
  function handleStep3(data: OnboardingData["predictability"]) {
    setPredictability(data);
    setStep(4);
  }
  function handleStep4(data: OnboardingData["goals"]) {
    onComplete({ incomeTypes, connectionMethod, predictability, goals: data });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-[var(--color-border)] px-6 py-3.5"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="max-w-md lg:max-w-lg mx-auto flex items-center justify-between">
          <img src={capitalOneLogo} alt="Capital One" className="h-6 object-contain"/>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--color-muted-foreground)]" style={{ letterSpacing: "0.08em" }}>
              STEP {step} OF {TOTAL_STEPS}
            </span>
          </div>
        </div>
        {/* Progress under header text */}
        <div className="max-w-md lg:max-w-lg mx-auto mt-3">
          <ProgressBar step={step} />
        </div>
      </header>

      {/* Step label */}
      <div className="max-w-md lg:max-w-lg mx-auto w-full px-6 pt-5">
        <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)]" style={{ letterSpacing: "0.12em" }}>
          {STEP_TITLES[step - 1]}
        </p>
      </div>

      {/* Step content */}
      <main className="flex-1 max-w-md lg:max-w-lg mx-auto w-full">
        {step === 1 && <IncomeTypeStep onNext={handleStep1} />}
        {step === 2 && (
          <IncomeConnectionStep
            onNext={handleStep2}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <IncomePredictabilityStep
            onNext={handleStep3}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <FinancialGoalsStep
            onComplete={handleStep4}
            onBack={() => setStep(3)}
          />
        )}
      </main>
    </div>
  );
}
