import { useState } from "react";
import IncomeTypeStep from "./IncomeTypeStep";
import IncomeConnectionStep from "./IncomeConnectionStep";
import IncomePredictabilityStep from "./IncomePredictabilityStep";
import FinancialGoalsStep from "./FinancialGoalsStep";

// Same shape OnboardingGate.tsx stores under ONBOARDING_DATA_KEY — this flow
// re-runs the same four questions from the user icon in the app header, so
// answers land in the same place whether they came from first-run onboarding
// or a later edit.
export interface ProfileAnswers {
  incomeTypes: { selected: string[]; primary: string | null };
  connectionMethod: { method: string };
  predictability: { predictability: string; recurring: string };
  goals: { goals: string[] };
}

interface Props {
  onComplete: (answers: ProfileAnswers) => void;
  onCancel: () => void;
}

const TOTAL_STEPS = 4;

export default function ProfileUpdateFlow({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [incomeTypes, setIncomeTypes] = useState<ProfileAnswers["incomeTypes"]>({ selected: [], primary: null });
  const [connectionMethod, setConnectionMethod] = useState<ProfileAnswers["connectionMethod"]>({ method: "" });
  const [predictability, setPredictability] = useState<ProfileAnswers["predictability"]>({ predictability: "", recurring: "" });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-md lg:max-w-lg mx-auto w-full min-h-screen flex flex-col">
        <div className="flex items-center justify-between px-6 pt-4">
          <div className="flex gap-1.5 flex-1 mr-4">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className="h-0.5 flex-1 rounded-full" style={{
                backgroundColor: i < step ? "var(--color-primary)" : "var(--color-border)",
              }}/>
            ))}
          </div>
          <button onClick={onCancel} className="text-sm text-[var(--color-muted-foreground)] shrink-0">Close</button>
        </div>

        <div className="flex-1">
          {step === 1 && (
            <IncomeTypeStep onNext={(d) => { setIncomeTypes(d); setStep(2); }} />
          )}
          {step === 2 && (
            <IncomeConnectionStep
              onNext={(d) => { setConnectionMethod(d); setStep(3); }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <IncomePredictabilityStep
              onNext={(d) => { setPredictability(d); setStep(4); }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <FinancialGoalsStep
              onComplete={(d) => onComplete({ incomeTypes, connectionMethod, predictability, goals: d })}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
