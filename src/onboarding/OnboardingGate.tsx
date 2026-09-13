import { useEffect, useState } from "react";
import App from "../App";
import OnboardingFlow from "./OnboardingFlow";

// Exported so App.tsx (the user-icon "edit profile" re-cycle) reads/writes
// the exact same storage this gate uses for first-run onboarding.
export const ONBOARDING_COMPLETE_KEY = "capfrog_onboarding_complete";
export const ONBOARDING_DATA_KEY = "capfrog_onboarding_data";

export interface OnboardingAnswers {
  incomeTypes: {
    selected: string[];
    primary: string | null;
  };
  connectionMethod: {
    method: string;
  };
  predictability: {
    predictability: string;
    recurring: string;
  };
  goals: {
    goals: string[];
  };
}

export interface StoredOnboardingData {
  answers: OnboardingAnswers;
  completedAt: string;
}

function hasCompletedOnboarding() {
  return window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}

export default function OnboardingGate() {
  const [isComplete, setIsComplete] = useState(() => hasCompletedOnboarding());

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    Object.assign(window, {
      capfrogResetOnboarding: () => {
        window.localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
        window.localStorage.removeItem(ONBOARDING_DATA_KEY);
        window.location.reload();
      },
    });

    console.info("Dev only: run window.capfrogResetOnboarding() to reset onboarding.");
  }, []);

  function handleComplete(answers: OnboardingAnswers) {
    const payload: StoredOnboardingData = {
      answers,
      completedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(payload));
    window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setIsComplete(true);
  }

  if (!isComplete) {
    return <OnboardingFlow onComplete={handleComplete} />;
  }

  return <App />;
}
