import { useState, useRef, useEffect } from "react";
import capitalOneLogo from "@/imports/image-3.png";
import frogStable     from "@/imports/image-5.png";
import frogMedium     from "@/imports/MONEY_GETTING_TIGHT_.jpeg";
import frogHigh       from "@/imports/high risk.jpg";
import transferImg    from "@/imports/transfer.jpg";
import {
  getUsuario, getRevision, getMonitoreo,
  editarUsuario, editarCuentas, aplicarPreset,
  simularDetalle, transferirPreview, transferir, chatear,
} from "./api";
import ProfileUpdateFlow, { type ProfileAnswers } from "./onboarding/ProfileUpdateFlow";
import { ONBOARDING_DATA_KEY, type StoredOnboardingData } from "./onboarding/OnboardingGate";

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskState  = "stable" | "medium" | "high";
type Screen     = "home" | "transfer" | "deposit" | "simulate" | "chat" | "help";
type AccountId  = "checking" | "emergency" | "bills" | "hysa" | "shortterm";
type NivelRiesgo = "bajo" | "medio" | "alto";

// Shapes returned by the FastAPI backend (backend/main.py). Loosely typed on
// purpose — the backend is still evolving and we don't want TS fighting it.
interface Riesgo {
  probabilidad: number;
  nivel: NivelRiesgo;
  drivers: string[];
  prob_quiebra_6m: number;
  meses_colchon: number;
}
interface Usuario {
  nombre: string;
  edad: number;
  ingreso_mensual: number;
  gastos_esenciales: number;
  gastos_discrecionales: number;
  pago_deuda_mensual: number;
  deuda_total: number;
  ahorro_liquido: number;
  estabilidad_ingreso: number;
  dependientes: number;
  seguro_medico: boolean;
  historial_gastos: number[];
}
interface Cuentas {
  balance: number;
  fondo_lluvia: number;
  gastos_fijos: number;
  alto_rendimiento: number;
  corto_plazo: number;
}
interface Plan {
  excedente_mensual: number;
  recorte_sugerido: number;
  meta_fondo_lluvia: number;
  faltante_fondo: number;
  meses_para_meta: number | null;
  aportaciones: { fondo_lluvia: number; alto_rendimiento: number; corto_plazo: number };
  interes_12m_hys: number;
}
interface Monitoreo {
  nivel: NivelRiesgo;
  probabilidad: number;
  drivers: string[];
  meses_colchon: number;
  acciones: string[];
  escenarios?: Record<string, boolean>;
  contacto?: { nombre: string; canal: string; telefono: string };
  programas?: { nombre: string; via: string }[];
  why?: string | null;
  whatif?: string | null;
  history?: string | null;
  mensaje_contacto?: string;
}

// ─── Backend ↔ frontend mappings ───────────────────────────────────────────
// backend/estado.py risk labels ("bajo"/"medio"/"alto") vs the frontend's
// stable/medium/high palette.
const NIVEL_TO_RISK: Record<NivelRiesgo, RiskState> = { bajo: "stable", medio: "medium", alto: "high" };

// Frontend account ids vs backend/mock_user.py CUENTAS keys.
const ACCOUNT_BACKEND_KEY: Record<AccountId, keyof Cuentas> = {
  checking:  "balance",
  emergency: "fondo_lluvia",
  bills:     "gastos_fijos",
  hysa:      "alto_rendimiento",
  shortterm: "corto_plazo",
};

// backend/features.py ORDEN — the risk drivers a user can be told about.
const DRIVER_LABELS: Record<string, string> = {
  tasa_ahorro:          "a low savings rate",
  meses_colchon:        "a thin cash cushion",
  dti:                  "high monthly debt payments",
  volatilidad_gasto:    "unpredictable spending",
  estabilidad_ingreso:  "unstable income",
  carga_dependientes:   "supporting dependents",
  exposicion_salud:     "health cost exposure",
  ratio_discrecional:   "high discretionary spending",
};

const VEREDICTO_LABELS: Record<string, string> = {
  adecuado:         "Looks good",
  demasiado:        "Larger than usual for this account",
  muy_poco:         "Smaller than your usual transfer",
  fondo_incompleto: "Emergency fund still building — consider that first",
};

// Demo preset cycle — mirrors backend/mock_user.py PRESETS, exposed via
// POST /preset/{nombre}. Tap the Capital One logo 5× to cycle through them.
const PRESET_CYCLE = ["sano", "ajustado", "critico"] as const;

// ─── Onboarding profile → backend feature ──────────────────────────────────
// Income predictability has a real counterpart in the risk model —
// backend/features.py's "estabilidad_ingreso" (0-1) — pushed via PATCH
// /usuario so it actually changes predictions, not just displayed text.
// The full profile (goals + predictability) is also sent along with chat,
// simulate-detail, and transfer requests (see perfilPayload()) so Gemini's
// explanations can reference stated goals directly; client-side, "goals"
// additionally re-prioritizes the Safe to Save pick (see topBucket()).
function estimateEstabilidad(p: ProfileAnswers["predictability"]): number {
  const base: Record<string, number> = { same: 0.9, somewhat: 0.65, alot: 0.4, project: 0.35, unsure: 0.5 };
  const adj:  Record<string, number> = { several: 0.05, one_two: 0, onetime: -0.05, unsure: 0 };
  const v = (base[p.predictability] ?? 0.5) + (adj[p.recurring] ?? 0);
  return Math.min(1, Math.max(0, v));
}

function readStoredProfile(): ProfileAnswers | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DATA_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as StoredOnboardingData).answers ?? null;
  } catch {
    return null;
  }
}

function storeProfile(answers: ProfileAnswers) {
  const payload: StoredOnboardingData = { answers, completedAt: new Date().toISOString() };
  window.localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(payload));
}

// Shape backend/main.py's Perfil model expects. Read fresh from storage at
// each call site rather than threaded through props — it's a cheap
// synchronous read and every screen that needs it already imports from here.
function perfilPayload(): { goals: string[]; predictability: string | null; recurring: string | null } | undefined {
  const stored = readStoredProfile();
  if (!stored) return undefined;
  return {
    goals: stored.goals.goals,
    predictability: stored.predictability.predictability || null,
    recurring: stored.predictability.recurring || null,
  };
}

// ─── Per-account savings goals ──────────────────────────────────────────────
// A small user-set target per account (distinct from the onboarding
// "goals" categories above) — e.g. "$1,500 in Short-term Savings for a
// trip". Purely local: there's no backend concept of a per-account goal,
// but it feeds topBucket()'s pick and reason above.
const ACCOUNT_GOALS_KEY = "capifrog_account_goals";

function readAccountGoals(): Partial<Record<keyof Cuentas, number>> {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_GOALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAccountGoals(goals: Partial<Record<keyof Cuentas, number>>) {
  window.localStorage.setItem(ACCOUNT_GOALS_KEY, JSON.stringify(goals));
}

// ─── Static per-tier styling (frog art + badge colors only — numbers below
// are always real, fetched from the backend) ───────────────────────────────
const RISK_STYLE: Record<RiskState, {
  frog: string; label: string;
  badge: { dot: string; text: string; bg: string };
}> = {
  stable: {
    frog: frogStable, label: "Stable",
    badge: { dot: "bg-[#2a9d8f]", text: "text-[#2a9d8f]", bg: "bg-[#e6f7f5]" },
  },
  medium: {
    frog: frogMedium, label: "Medium Risk",
    badge: { dot: "bg-[#c4834a]", text: "text-[#c4834a]", bg: "bg-[var(--color-warning-bg)]" },
  },
  high: {
    frog: frogHigh, label: "High Risk",
    badge: { dot: "bg-[#c0392b]", text: "text-[#c0392b]", bg: "bg-[var(--color-danger-bg)]" },
  },
};

// ─── Credit Readiness demo data ────────────────────────────────────────────
// MOCK: the backend has no credit-score model or monthly income/expense
// history endpoint yet (usuario.historial_gastos is only 6 points of total
// spending, no income breakdown) — nothing real to wire here yet.
const MONTHS  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
const MONTHLY_INCOME   = [2100,1400,2800,1600,3200,2400,1200,2700,1900,3100,2200,2600];
const MONTHLY_EXPENSES = [1780,1750,1820,1780,1860,1830,1700,1840,1760,1890,1810,1870];
const AVG_INCOME   = Math.round(MONTHLY_INCOME.reduce((a,b)=>a+b,0)/12);
const AVG_EXPENSES = Math.round(MONTHLY_EXPENSES.reduce((a,b)=>a+b,0)/12);
const AVG_REMAINING = AVG_INCOME - AVG_EXPENSES;

// ─── Account display metadata (values come from the backend at runtime) ───
const ACCOUNT_META: { id: AccountId; label: string }[] = [
  { id: "checking",  label: "Checking" },
  { id: "emergency", label: "Emergency Fund" },
  { id: "bills",     label: "Routine Bills" },
  { id: "hysa",      label: "High-Yield Savings" },
  { id: "shortterm", label: "Short-term Savings" },
];

type Account = { id: AccountId; label: string; value: number; note?: string };

function buildAccounts(cuentas: Cuentas, plan: Plan | null): Account[] {
  const remaining = plan ? plan.meta_fondo_lluvia - cuentas.fondo_lluvia : null;
  return ACCOUNT_META.map((meta) => {
    const value = cuentas[ACCOUNT_BACKEND_KEY[meta.id]];
    let note: string | undefined;
    if (meta.id === "emergency" && remaining != null) {
      note = remaining > 1 ? `$${Math.round(remaining).toLocaleString()} to goal` : "Goal reached";
    }
    return { id: meta.id, label: meta.label, value, note };
  });
}

// A short, static bullet summary for the Home hero — the single most
// important facts, computed directly from real numbers (no Gemini call
// needed, so it's never blank and never flaky).
function keyInsights(risk: RiskState, riesgo: Riesgo, plan: Plan | null): string {
  const cushion = riesgo.meses_colchon.toFixed(1);
  const driver  = riesgo.drivers[0] ? (DRIVER_LABELS[riesgo.drivers[0]] ?? riesgo.drivers[0]) : null;
  const lines = [`- ${RISK_STYLE[risk].label} — about ${cushion} months of cushion`];
  if (plan && plan.excedente_mensual > 0) lines.push(`- $${Math.round(plan.excedente_mensual)} is safe to save this month`);
  else lines.push("- Budget is tight this month — nothing extra to save");
  if (driver) lines.push(`- Main factor: ${driver}`);
  return lines.join("\n");
}

// Which savings bucket to lead with in "Safe to Save" — amount-highest by
// default, but a bucket tied to one of the user's onboarding goals (see
// src/onboarding) wins among buckets that actually have money to move.
const GOAL_TO_BUCKET: Record<string, keyof Plan["aportaciones"]> = {
  emergency: "fondo_lluvia",
  irregular: "fondo_lluvia",
  slow:      "fondo_lluvia",
  shortterm: "corto_plazo",
  save:      "alto_rendimiento",
};

// Benefit each bucket actually offers, independent of any goal — the
// reason shown in Safe to Save should always be about why that account is
// worth saving into, not about "reaching a goal" the user may never have set.
const BUCKET_BENEFIT: Record<"fondo_lluvia" | "alto_rendimiento" | "corto_plazo", string> = {
  fondo_lluvia:     "Builds your safety net for emergencies.",
  alto_rendimiento: "Earns the most interest of your savings options.",
  corto_plazo:      "Grows your short-term savings fastest.",
};

function topBucket(plan: Plan, cuentas: Cuentas, goals: string[] = [], accountGoals: Partial<Record<keyof Cuentas, number>> = {}) {
  const buckets = [
    { key: "fondo_lluvia" as const,     label: "Emergency Fund",     amount: plan.aportaciones.fondo_lluvia },
    { key: "alto_rendimiento" as const, label: "High-Yield Savings", amount: plan.aportaciones.alto_rendimiento },
    { key: "corto_plazo" as const,      label: "Short-term Savings", amount: plan.aportaciones.corto_plazo },
  ];
  const positive  = buckets.filter((b) => b.amount > 0);
  const pool      = positive.length ? positive : buckets;

  // A bucket is preferred if it matches a stated onboarding goal, OR the
  // user set a personal goal on it that isn't met yet — either way, a real
  // preference the user expressed, not an assumption.
  const onboardingPreferred = new Set(goals.map((g) => GOAL_TO_BUCKET[g]).filter(Boolean));
  const goalUnmet = new Set(
    pool.filter((b) => {
      const goal = accountGoals[b.key];
      return goal != null && goal > 0 && cuentas[b.key] < goal;
    }).map((b) => b.key),
  );
  const preferred = new Set([...onboardingPreferred, ...goalUnmet]);
  const preferredPool = pool.filter((b) => preferred.has(b.key));
  const chosen = (preferredPool.length ? preferredPool : pool).sort((a, b) => b.amount - a.amount)[0];

  const goal = accountGoals[chosen.key];
  const reason = goal != null && goal > 0 && cuentas[chosen.key] < goal
    ? `Gets you $${Math.round(Math.min(chosen.amount, goal - cuentas[chosen.key])).toLocaleString()} closer to your $${Math.round(goal).toLocaleString()} goal for this account.`
    : BUCKET_BENEFIT[chosen.key];
  return { ...chosen, reason };
}

// Derives a 0-100 "credit readiness" style score directly from the trained
// risk model's probability, so it can never contradict the risk badge the
// way a hardcoded score could. There's no separate credit-score model on
// the backend — this is the same number the risk badge is built from.
function creditReadiness(riesgo: Riesgo, plan: Plan | null, cuentas: Cuentas | null, goals: string[] = [],
  accountGoals: Partial<Record<keyof Cuentas, number>> = {}) {
  const score = Math.max(0, Math.min(100, Math.round((1 - riesgo.probabilidad) * 100)));
  const label = score >= 70 ? "Building Strongly" : score >= 40 ? "Needs Attention" : "At Risk";
  const trend = score >= 40 ? "↑" : "↓";
  const top = plan && cuentas ? topBucket(plan, cuentas, goals, accountGoals) : null;
  const action = top && top.amount > 0
    ? `Add $${Math.round(top.amount)} to your ${top.label}.`
    : "Keep an eye on your monthly spending.";
  return { score, label, trend, action };
}

// Renders Gemini-authored text (backend/gemini_texto.py) with real paragraph
// and line breaks instead of one squished block — the SISTEM prompt asks for
// blank-line-separated paragraphs, dash-bullets for lists, and no markdown.
function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = splitParagraphs(text);
  return (
    <>
      {paragraphs.map((para, i) => {
        const lines  = para.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));
        const spacing = i < paragraphs.length - 1 ? "mb-2" : "";
        if (isList) {
          return (
            <ul key={i} className={`${className} ${spacing} space-y-1`}>
              {lines.map((l, j) => (
                <li key={j} className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>{l.slice(2)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={`${className} ${spacing}`}>
            {lines.map((line, j, arr) => (
              <span key={j}>{line}{j < arr.length - 1 && <br/>}</span>
            ))}
          </p>
        );
      })}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function HairlineRule({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-[var(--color-border)] ${className}`} />;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] py-3 font-medium">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--color-border)] shrink-0">
      <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Speech bubble — tail left, pointing toward frog
function SpeechBubble({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div style={{ position:"absolute", top:16, left:-8, width:0, height:0,
        borderTop:"7px solid transparent", borderBottom:"7px solid transparent",
        borderRight:"8px solid white", filter:"drop-shadow(-1px 0 0 var(--color-border))" }} />
      <div className="bg-white border border-[var(--color-border)] rounded-2xl px-4 py-3 shadow-sm">
        {children}
      </div>
    </div>
  );
}

// Speech bubble down-tail for transfer review
function SpeechBubbleDown({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="bg-white border border-[var(--color-border)] rounded-2xl px-4 py-3 shadow-sm">{children}</div>
      <div style={{ position:"absolute", bottom:-8, left:18, width:0, height:0,
        borderLeft:"8px solid transparent", borderTop:"8px solid white",
        filter:"drop-shadow(0 1px 0 var(--color-border))" }} />
    </div>
  );
}

// ─── Floating modal shell ─────────────────────────────────────────────────────
function FloatingModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", backgroundColor:"rgba(13,31,45,0.2)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-3xl overflow-hidden"
        style={{
          maxWidth: 340,
          background: "rgba(255,255,255,0.97)",
          boxShadow: "0 20px 60px rgba(13,31,45,0.16), 0 4px 16px rgba(13,31,45,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Shared modal header
function ModalHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)]" style={{ letterSpacing:"0.13em" }}>{label}</p>
      <button onClick={onClose} className="text-[var(--color-muted-foreground)] opacity-40 hover:opacity-80 transition-opacity">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M3 3l9 9M12 3L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// Stat row inside modal
function StatRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p style={{ fontFamily:"var(--font-serif)" }} className={`text-base ${accent ? "text-[#2a9d8f]" : "text-[var(--color-foreground)]"}`}>{value}</p>
    </div>
  );
}

// Small inline editor for a per-account savings goal — click the amount (or
// "Set a goal") to swap in a number field. Used in every account modal.
function GoalEditor({ goal, onSave }: { goal: number | undefined; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState("");

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-2.5">
        <p className="text-xs text-[var(--color-muted-foreground)]">Your Goal</p>
        <button onClick={() => { setValue(goal ? String(goal) : ""); setEditing(true); }}
          className="text-sm font-medium text-[var(--color-primary)]">
          {goal ? `$${goal.toLocaleString()}` : "Set a goal"}
        </button>
      </div>
    );
  }
  return (
    <div className="py-2.5">
      <p className="text-xs text-[var(--color-muted-foreground)] mb-1.5">Your Goal</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2 text-xs text-[var(--color-muted-foreground)]">$</span>
          <input type="number" placeholder="0" value={value} autoFocus onChange={(e) => setValue(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg pl-6 pr-2 py-1.5 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
        </div>
        <button onClick={() => { onSave(parseFloat(value) > 0 ? parseFloat(value) : null); setEditing(false); }}
          className="text-xs font-semibold text-white bg-[var(--color-primary)] rounded-lg px-3 py-1.5 shrink-0">
          Save
        </button>
        {goal != null && (
          <button onClick={() => { onSave(null); setEditing(false); }}
            className="text-xs font-medium text-[var(--color-muted-foreground)] shrink-0">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Light bar chart (no axes, transparent bg) ────────────────────────────────
function MiniChart() {
  const W = 280, H = 80, BAR = 8, GAP = 2;
  const SLOT = W / 12;
  const max  = Math.max(...MONTHLY_INCOME, ...MONTHLY_EXPENSES);
  const sy   = (v: number) => H - (v / max) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full">
      {MONTHLY_INCOME.map((inc, i) => {
        const exp = MONTHLY_EXPENSES[i];
        const cx  = i * SLOT + SLOT / 2;
        const iy  = sy(inc), ih = H - iy;
        const ey  = sy(exp), eh = H - ey;
        return (
          <g key={i}>
            <rect x={cx - BAR - GAP/2} y={iy} width={BAR} height={ih} rx="2" fill="#2a9d8f" opacity="0.7"/>
            <rect x={cx + GAP/2}       y={ey} width={BAR} height={eh} rx="2" fill="#004977" opacity="0.3"/>
            <text x={cx} y={H + 12} textAnchor="middle" fontSize="7" fill="#8ba3b2">{MONTHS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Account modals ───────────────────────────────────────────────────────────
type AccountGoals = Partial<Record<keyof Cuentas, number>>;
type SetAccountGoal = (key: keyof Cuentas, amount: number | null) => void;

function CheckingModal({ onClose, cuentas, usuario, plan, accountGoals, onSetGoal }:
  { onClose: () => void; cuentas: Cuentas; usuario: Usuario; plan: Plan | null; accountGoals: AccountGoals; onSetGoal: SetAccountGoal }) {
  const monthlyIncome   = usuario.ingreso_mensual;
  const monthlySpending = usuario.gastos_esenciales + usuario.gastos_discrecionales;
  const safe = plan ? Math.max(Math.round(plan.excedente_mensual), 0) : null;
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Checking" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-4">
          ${cuentas.balance.toLocaleString("en-US",{minimumFractionDigits:2})}
        </p>
        <HairlineRule className="mb-1" />
        <StatRow label="Monthly income"   value={`$${Math.round(monthlyIncome).toLocaleString()}`} />
        <HairlineRule />
        <StatRow label="Monthly spending" value={`$${Math.round(monthlySpending).toLocaleString()}`} />
        <HairlineRule />
        <StatRow label="Safe to use"      value={safe != null ? `$${safe}` : "—"} accent />
        <HairlineRule />
        <GoalEditor goal={accountGoals.balance} onSave={(v) => onSetGoal("balance", v)}/>
      </div>
    </FloatingModal>
  );
}

function EmergencyModal({ onClose, cuentas, usuario, plan, accountGoals, onSetGoal }:
  { onClose: () => void; cuentas: Cuentas; usuario: Usuario; plan: Plan | null; accountGoals: AccountGoals; onSetGoal: SetAccountGoal }) {
  const goal = plan?.meta_fondo_lluvia ?? cuentas.fondo_lluvia;
  const pct  = goal > 0 ? Math.min(100, Math.round((cuentas.fondo_lluvia / goal) * 100)) : 100;
  const weeksCovered = usuario.gastos_esenciales > 0
    ? (cuentas.fondo_lluvia / usuario.gastos_esenciales) * 4.345
    : 0;
  const nextContribution = plan ? Math.round(plan.aportaciones.fondo_lluvia) : null;
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Emergency Fund" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-1">
          ${Math.round(cuentas.fondo_lluvia).toLocaleString()}
        </p>
        {/* This "goal" is the model's suggested safety target (6 months of
            essentials) — separate from the personal goal you can set below. */}
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4">of ${Math.round(goal).toLocaleString()} suggested safety target</p>
        <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-4">
          <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${pct}%` }}/>
        </div>
        <HairlineRule className="mb-1" />
        <StatRow label="Progress"          value={`${pct}%`} />
        <HairlineRule />
        <StatRow label="Covers essentials" value={`~${weeksCovered.toFixed(1)} weeks`} />
        <HairlineRule />
        <StatRow label="Next contribution" value={nextContribution != null ? `$${nextContribution}` : "—"} accent />
        <HairlineRule />
        <GoalEditor goal={accountGoals.fondo_lluvia} onSave={(v) => onSetGoal("fondo_lluvia", v)}/>
      </div>
    </FloatingModal>
  );
}

function BillsModal({ onClose, cuentas, accountGoals, onSetGoal }:
  { onClose: () => void; cuentas: Cuentas; accountGoals: AccountGoals; onSetGoal: SetAccountGoal }) {
  // MOCK: the backend tracks a single "gastos_fijos" balance, not individual
  // bills with due dates — the line items below are illustrative only.
  const bills = [
    { name:"Rent",         amount:1200, due:"Sep 15", paid:false },
    { name:"Electric",     amount:78,   due:"Sep 18", paid:false },
    { name:"Student Loan", amount:210,  due:"Sep 20", paid:true  },
  ];
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Routine Bills" onClose={onClose} />
        <div className="flex items-baseline gap-2 mb-4">
          <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)]">
            ${Math.round(cuentas.gastos_fijos).toLocaleString()}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">this month</p>
        </div>
        <div className="space-y-0">
          {bills.map((b, i) => (
            <div key={b.name}>
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-[var(--color-foreground)]">{b.name}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{b.due}</p>
                </div>
                <div className="flex items-center gap-2">
                  {b.paid
                    ? <span className="text-[10px] font-semibold text-[#2a9d8f] bg-[#e6f7f5] px-2 py-0.5 rounded-full">Paid</span>
                    : <span className="text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full">Due</span>
                  }
                  <p style={{ fontFamily:"var(--font-serif)" }} className="text-sm text-[var(--color-foreground)]">${b.amount}</p>
                </div>
              </div>
              {i < bills.length - 1 && <HairlineRule />}
            </div>
          ))}
        </div>
        <HairlineRule />
        <GoalEditor goal={accountGoals.gastos_fijos} onSave={(v) => onSetGoal("gastos_fijos", v)}/>
      </div>
    </FloatingModal>
  );
}

// backend/mock_user.py RENDIMIENTO_HYS = 0.09 — not exposed over the API yet,
// mirrored here so the displayed APY matches what the backend actually uses.
const RENDIMIENTO_HYS_DISPLAY = 0.09;

function HYSAModal({ onClose, cuentas, plan, risk, accountGoals, onSetGoal }:
  { onClose: () => void; cuentas: Cuentas; plan: Plan | null; risk: RiskState; accountGoals: AccountGoals; onSetGoal: SetAccountGoal }) {
  const recommended = risk === "stable";
  const yearly = plan ? Math.round(plan.interes_12m_hys) : Math.round(cuentas.alto_rendimiento * RENDIMIENTO_HYS_DISPLAY);
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="High-Yield Savings" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-4">
          ${Math.round(cuentas.alto_rendimiento).toLocaleString()}
        </p>
        <HairlineRule className="mb-1" />
        <StatRow label="APY"                  value={`${(RENDIMIENTO_HYS_DISPLAY*100).toFixed(1)}%`} />
        <HairlineRule />
        <StatRow label="Est. yearly earnings" value={`$${yearly}`} accent />
        <HairlineRule />
        <div className="py-2.5">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {recommended
              ? "Best place for idle cash right now — earning above inflation."
              : "When stable again, move surplus here first."}
          </p>
        </div>
        <HairlineRule />
        <GoalEditor goal={accountGoals.alto_rendimiento} onSave={(v) => onSetGoal("alto_rendimiento", v)}/>
      </div>
    </FloatingModal>
  );
}

function ShortTermModal({ onClose, cuentas, plan, accountGoals, onSetGoal }:
  { onClose: () => void; cuentas: Cuentas; plan: Plan | null; accountGoals: AccountGoals; onSetGoal: SetAccountGoal }) {
  // Goal defaults to $1,000 until the user sets their own via GoalEditor below.
  const goal = accountGoals.corto_plazo ?? 1000;
  const pct  = Math.min(100, Math.round((cuentas.corto_plazo / goal) * 100));
  const monthly = plan && plan.excedente_mensual > 0 ? plan.excedente_mensual : 80;
  const monthsLeft = Math.max(0, Math.ceil((goal - cuentas.corto_plazo) / monthly));
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Short-term Savings" onClose={onClose} />
        <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1 uppercase" style={{ letterSpacing:"0.1em" }}>Vacation Fund</p>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-1">
          ${Math.round(cuentas.corto_plazo).toLocaleString()}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4">of ${goal.toLocaleString()} goal</p>
        <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-4">
          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width:`${pct}%` }}/>
        </div>
        <HairlineRule className="mb-1" />
        <StatRow label="Progress"          value={`${pct}%`} />
        <HairlineRule />
        <StatRow label="Est. time to goal" value={monthsLeft > 0 ? `~${monthsLeft} months` : "Goal reached"} accent />
        <HairlineRule />
        <GoalEditor goal={accountGoals.corto_plazo} onSave={(v) => onSetGoal("corto_plazo", v)}/>
      </div>
    </FloatingModal>
  );
}

// ─── Credit Readiness modal ───────────────────────────────────────────────────
// Score/label/action are derived from the real risk probability (see
// creditReadiness() above) so they can't contradict the risk badge. The
// income/expense chart stays MOCK: no monthly income-history endpoint yet.
function CreditReadinessModal({ onClose, riesgo, plan, cuentas, goals, accountGoals }:
  { onClose: () => void; riesgo: Riesgo; plan: Plan | null; cuentas: Cuentas; goals: string[]; accountGoals: AccountGoals }) {
  const cr = creditReadiness(riesgo, plan, cuentas, goals, accountGoals);
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Credit Readiness" onClose={onClose} />

        {/* Score */}
        <div className="flex items-baseline gap-2 mb-1">
          <p style={{ fontFamily:"var(--font-serif)" }} className="text-5xl text-[var(--color-foreground)]">{cr.score}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">/ 100</p>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2a9d8f]"/>
          <p className="text-xs font-semibold text-[#2a9d8f]">{cr.label} {cr.trend}</p>
        </div>
        <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden mt-3 mb-4">
          <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${cr.score}%` }}/>
        </div>

        {/* Legend + chart — MOCK: no monthly income-history endpoint yet */}
        <div className="flex items-center gap-4 mb-2">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
            <span className="w-2 h-1.5 rounded-sm inline-block bg-[#2a9d8f] opacity-70"/>Income
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
            <span className="w-2 h-1.5 rounded-sm inline-block bg-[#004977] opacity-30"/>Expenses
          </span>
        </div>
        <MiniChart />

        {/* Stats */}
        <div className="flex mt-3 mb-4">
          {[
            { label:"Income",   value:`$${AVG_INCOME.toLocaleString()}` },
            { label:"Expenses", value:`$${AVG_EXPENSES.toLocaleString()}` },
            { label:"Left",     value:`$${AVG_REMAINING.toLocaleString()}`, accent:true },
          ].map(({ label, value, accent }, i, arr) => (
            <div key={label} className={`flex-1 text-center ${i < arr.length-1 ? "border-r border-[var(--color-border)]" : ""}`}>
              <p className="text-[9px] text-[var(--color-muted-foreground)] uppercase mb-0.5" style={{ letterSpacing:"0.07em" }}>{label}</p>
              <p style={{ fontFamily:"var(--font-serif)" }} className={`text-sm ${accent ? "text-[#2a9d8f]" : "text-[var(--color-foreground)]"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Next step */}
        <div className="rounded-2xl bg-[#e6f7f5] px-4 py-3 flex items-center gap-2">
          <span className="text-[#2a9d8f] text-xs">✧</span>
          <p className="text-xs font-medium text-[#2a9d8f]">{cr.action}</p>
        </div>
      </div>
    </FloatingModal>
  );
}

// ─── Chat screen ──────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "frog"; text: string };

function ChatScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg = RISK_STYLE[risk];
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role:"frog", text:`Hi! Ask me anything about your finances.` },
  ]);
  const [input, setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    risk === "stable" ? "Why am I stable?" : risk === "medium" ? "Why medium risk?" : "Why high risk?",
    "Where should I save?",
    "How long will my money last?",
    "What if I spend $500?",
  ];

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setMsgs((m) => [...m, { role:"user", text:q }]);
    setInput("");
    setSending(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    try {
      const r = await chatear(q, perfilPayload()); // POST /chat — backend/chat.py
      setMsgs((m) => [...m, { role:"frog", text: r.texto || "I couldn't find an answer for that." }]);
    } catch {
      setMsgs((m) => [...m, { role:"frog", text: "I couldn't reach the server just now — try again in a moment." }]);
    } finally {
      setSending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-57px)]">
      <div className="px-6 pt-2 pb-2 border-b border-[var(--color-border)] flex items-center gap-3">
        <BackButton onBack={onBack} />
        <img src={cfg.frog} alt="frog" className="w-8 h-8 object-contain"/>
        <p className="text-sm font-medium text-[var(--color-foreground)]">Ask CapiFrog</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {m.role === "frog" && <img src={cfg.frog} alt="frog" className="w-8 h-8 object-contain shrink-0 self-end"/>}
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === "frog"
                ? "bg-white border border-[var(--color-border)] text-[var(--color-foreground)] rounded-bl-sm"
                : "bg-[var(--color-primary)] text-white rounded-br-sm"
            }`}>{m.role === "frog" ? <FormattedText text={m.text}/> : m.text}</div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2">
            <img src={cfg.frog} alt="frog" className="w-8 h-8 object-contain shrink-0 self-end"/>
            <div className="px-3.5 py-2.5 rounded-2xl text-sm bg-white border border-[var(--color-border)] text-[var(--color-muted-foreground)] rounded-bl-sm">…</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto">
        {suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={sending}
            className="shrink-0 text-[11px] font-medium bg-[var(--color-secondary)] text-[var(--color-primary)] px-3 py-1.5 rounded-full border border-[var(--color-border)] disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <div className="px-4 pb-5 pt-2 border-t border-[var(--color-border)] flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your finances…"
          className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
        <button onClick={() => send(input)} disabled={sending} className="bg-[var(--color-primary)] text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60">Send</button>
      </div>
    </div>
  );
}

// ─── Help screen ──────────────────────────────────────────────────────────────
function HelpScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg = RISK_STYLE[risk];
  const [monitoreo, setMonitoreo] = useState<Monitoreo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [trustedSent, setTrustedSent] = useState(false);
  const [showResources, setShowResources] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMonitoreo() // GET /monitoreo — backend/plan.py monitorear()
      .then((m) => { if (alive) setMonitoreo(m); })
      .catch(() => { if (alive) setMonitoreo(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const cushion = monitoreo?.meses_colchon ?? 0;

  return (
    <div className="px-6 pt-4 pb-24">
      <BackButton onBack={onBack}/>
      <div className="flex items-center gap-3 mb-5">
        <img src={cfg.frog} alt="frog" className="w-12 h-12 object-contain"/>
        <div>
          <p style={{ fontFamily:"var(--font-serif)" }} className="text-xl text-[var(--color-foreground)]">Find Help Early</p>
          <div className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full ${cfg.badge.bg}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${cfg.badge.dot}`}/>
            <span className={`text-[10px] font-semibold ${cfg.badge.text}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Loading your risk details…</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <p style={{ fontFamily:"var(--font-serif)" }} className={`text-4xl ${cfg.badge.text}`}>{cushion.toFixed(1)}</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">months cushion</p>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-5">
            <div className="h-full rounded-full" style={{ width:`${Math.min(100,(cushion/6)*100)}%`,
              backgroundColor: risk==="stable"?"#2a9d8f":risk==="medium"?"#c4834a":"#c0392b" }}/>
          </div>

          {/* Three distinctly colored sections — why (blue), what-if scenarios
              (orange), and spending history (gray) — kept separate on purpose
              so each kind of information reads as visually distinct, rather
              than one undifferentiated block. */}
          <div className="space-y-3 mb-5">
            {monitoreo?.why && (
              <div className="bg-[var(--color-secondary)] border border-blue-100 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[var(--color-primary)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Why</p>
                <FormattedText text={monitoreo.why} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
              </div>
            )}
            {monitoreo?.whatif && (
              <div className="bg-[var(--color-warning-bg)] border border-orange-200 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[var(--color-warning)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>What If</p>
                <FormattedText text={monitoreo.whatif} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
              </div>
            )}
            {monitoreo?.history && (
              <div className="bg-[var(--color-muted)] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Your Spending History</p>
                <FormattedText text={monitoreo.history} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
              </div>
            )}
          </div>

          {risk === "high" && (
            <div className="space-y-3">
              {!trustedSent ? (
                <button onClick={() => setTrustedSent(true)}
                  className="w-full flex items-center justify-center gap-2 border border-[#2a9d8f] bg-[#e6f7f5] rounded-2xl py-4 text-sm font-medium text-[#2a9d8f]">
                  Notify {monitoreo?.contacto?.nombre ?? "a Trusted Person"}
                </button>
              ) : (
                <div className="w-full border border-[#2a9d8f] bg-[#e6f7f5] rounded-2xl py-4 px-4 flex flex-col items-center justify-center gap-1 text-center">
                  <p className="text-sm font-medium text-[#2a9d8f]">✓ Draft ready for {monitoreo?.contacto?.canal ?? "your contact"}</p>
                  {monitoreo?.mensaje_contacto && (
                    <FormattedText text={monitoreo.mensaje_contacto} className="text-xs text-[var(--color-foreground)] mt-1"/>
                  )}
                </div>
              )}
              {(monitoreo?.programas?.length ?? 0) > 0 && (
                <button onClick={() => setShowResources((v) => !v)}
                  className="w-full flex items-center justify-between border border-red-200 bg-[var(--color-danger-bg)] rounded-2xl px-5 py-4 text-sm font-medium text-[#c0392b]">
                  View Assistance Resources <Chevron/>
                </button>
              )}
              {showResources && (
                <div className="bg-[var(--color-danger-bg)] border border-red-200 rounded-2xl p-4 space-y-3">
                  {(monitoreo?.programas ?? []).map((p) => (
                    <div key={p.nombre} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-foreground)]">{p.nombre}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{p.via}</p>
                      </div>
                      <Chevron/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Simulate screen ──────────────────────────────────────────────────────────
// backend/plan.py simular_compra() always runs exactly these three scenarios —
// they line up 1:1 with the tabs below.
const SIM_ESCENARIOS = {
  spend: { label:"Spend Now", key:"gastar_ahora" },
  delay: { label:"Delay",     key:"posponer_6m" },
  save:  { label:"Save",      key:"no_gastar_y_ahorrar" },
};
type SimKey = keyof typeof SIM_ESCENARIOS;

interface EscenarioDetalle { pros: string; cons: string; risk: string }

function SimulateScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg    = RISK_STYLE[risk];
  const [amount, setAmount] = useState("");
  const [active, setActive] = useState<SimKey>("save");
  // Pros/cons/risk are per-scenario and re-fetched whenever the amount or
  // the active tab changes — deliberately NOT a cross-scenario comparison
  // (switching tabs would be pointless if it just repeated the same summary).
  const [detalle, setDetalle] = useState<EscenarioDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const parsed = parseFloat(amount) || 0;

  useEffect(() => {
    if (parsed <= 0) { setDetalle(null); return; }
    const t = setTimeout(() => {
      setLoading(true);
      simularDetalle(parsed, SIM_ESCENARIOS[active].key, perfilPayload(), 6) // POST /simulacion/detalle
        .then((r) => setDetalle(r.pros ? { pros: r.pros, cons: r.cons, risk: r.risk } : null))
        .catch(() => setDetalle(null))
        .finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [parsed, active]);

  const d = SIM_ESCENARIOS[active];

  return (
    <div className="px-6 pt-4 pb-24">
      <BackButton onBack={onBack}/>
      <div className="flex items-center gap-3 mb-6">
        <img src={cfg.frog} alt="frog" className="w-12 h-12 object-contain"/>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">Simulate</p>
      </div>
      <div className="mb-5">
        <div className="relative">
          <span className="absolute left-4 top-3.5 text-sm text-[var(--color-muted-foreground)]">$</span>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-xl pl-8 pr-4 py-3 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
        </div>
      </div>
      <div className="flex gap-1 bg-[var(--color-muted)] rounded-xl p-1 mb-5">
        {(Object.keys(SIM_ESCENARIOS) as SimKey[]).map((k) => (
          <button key={k} onClick={() => setActive(k)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${active===k?"bg-white text-[var(--color-primary)] shadow-sm":"text-[var(--color-muted-foreground)]"}`}>
            {SIM_ESCENARIOS[k].label}
          </button>
        ))}
      </div>

      {parsed <= 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Enter an amount to see the pros, cons, and risk of {d.label.toLowerCase()}.</p>
      ) : loading && !detalle ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Running the numbers…</p>
      ) : detalle ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 bg-[#e6f7f5] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-[#2a9d8f] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Pros</p>
              <FormattedText text={detalle.pros} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
            </div>
            <div className="flex-1 bg-[var(--color-warning-bg)] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-[var(--color-warning)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Cons</p>
              <FormattedText text={detalle.cons} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
            </div>
          </div>
          <div className="bg-[var(--color-muted)] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Risk</p>
            <FormattedText text={detalle.risk} className="text-xs text-[var(--color-foreground)] leading-relaxed"/>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">Couldn't reach the server — try again.</p>
      )}
    </div>
  );
}

// ─── Transfer / Deposit screens ───────────────────────────────────────────────
interface TransferPreview { ok: boolean; veredicto?: string; texto?: string }

function TransferScreen({ onBack, risk, accounts, onMutated }:
  { onBack: () => void; risk: RiskState; accounts: Account[]; onMutated: () => Promise<void> }) {
  const [from, setFrom]   = useState("checking");
  const [to, setTo]       = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const isReady = Boolean(from && to && to !== from && parseFloat(amount) > 0);
  const frogImg = RISK_STYLE[risk].frog;
  const sel = "w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-white appearance-none focus:outline-none focus:border-[var(--color-primary)] transition-colors";

  // CapiFrog's advice on the transfer, fetched BEFORE anything moves — a
  // dry-run against POST /transferencia/preview (backend/main.py), which
  // computes the same verdict+text as the real transfer without touching
  // any balances.
  useEffect(() => {
    if (!isReady) { setPreview(null); return; }
    const t = setTimeout(() => {
      setPreviewLoading(true);
      transferirPreview(ACCOUNT_BACKEND_KEY[from as AccountId], ACCOUNT_BACKEND_KEY[to as AccountId], parseFloat(amount), perfilPayload())
        .then((r) => setPreview(r))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [isReady, from, to, amount]);

  async function confirm() {
    if (!isReady || busy || previewLoading || !preview || preview.ok === false) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      // POST /transferencia — actually moves the money.
      const r = await transferir(ACCOUNT_BACKEND_KEY[from as AccountId], ACCOUNT_BACKEND_KEY[to as AccountId], parseFloat(amount), perfilPayload());
      if (!r.ok) {
        setErrorMsg(r.texto || "That transfer didn't go through.");
        return;
      }
      await onMutated();
      setDone(true);
    } catch {
      setErrorMsg("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return (
    <div className="px-6 pt-12 pb-24 flex flex-col items-center text-center">
      <img src={transferImg} alt="Transfer complete" className="w-24 h-24 object-contain mb-5"/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2">Transfer sent!</p>
      <button onClick={onBack} className="text-sm font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-6 py-2.5">Back</button>
    </div>
  );

  return (
    <div className="px-6 pt-4 pb-28">
      <BackButton onBack={onBack}/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-6">Transfer</p>
      <div className="space-y-4">
        {[{lbl:"From",val:from,set:setFrom,opts:accounts.filter((a)=>a.id!=="bills"),bal:true},
          {lbl:"To",  val:to,  set:setTo,  opts:accounts.filter((a)=>a.id!==from&&a.id!=="bills"),bal:false}
        ].map(({lbl,val,set,opts,bal}) => (
          <div key={lbl}>
            <p className="text-[10px] text-[var(--color-muted-foreground)] uppercase mb-1.5" style={{ letterSpacing:"0.1em" }}>{lbl}</p>
            <div className="relative">
              <select value={val} onChange={(e) => set(e.target.value)} className={sel}>
                {lbl==="To" && <option value="">Select account</option>}
                {opts.map((a) => <option key={a.id} value={a.id}>{a.label}{bal?` — $${a.value.toLocaleString()}`:""}</option>)}
              </select>
              <svg className="absolute right-3 top-3.5 text-[var(--color-muted-foreground)] pointer-events-none" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        ))}
        <div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] uppercase mb-1.5" style={{ letterSpacing:"0.1em" }}>Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-sm text-[var(--color-muted-foreground)]">$</span>
            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-xl pl-8 pr-4 py-3 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
          </div>
        </div>
      </div>
      {isReady && (
        <div className="mt-7">
          <HairlineRule className="mb-5"/>
          {previewLoading && !preview ? (
            <p className="text-sm text-[var(--color-muted-foreground)] mb-4">CapiFrog is checking this transfer…</p>
          ) : preview?.ok === false ? (
            <p className="text-sm font-medium text-[#c0392b] mb-4">{preview.texto ?? "That transfer isn't possible."}</p>
          ) : preview ? (
            <SpeechBubbleDown className="mb-4">
              {preview.veredicto && VEREDICTO_LABELS[preview.veredicto] && (
                <span className="inline-block text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-secondary)] px-2 py-0.5 rounded-full mb-2">
                  {VEREDICTO_LABELS[preview.veredicto]}
                </span>
              )}
              {preview.texto && <FormattedText text={preview.texto} className="text-sm text-[var(--color-foreground)]"/>}
            </SpeechBubbleDown>
          ) : null}
          {errorMsg && <p className="text-xs font-medium text-[#c0392b] mb-3">{errorMsg}</p>}
          <div className="flex items-end gap-3">
            <img src={frogImg} alt="frog" className="w-11 h-11 object-contain shrink-0"/>
            <div className="flex gap-2 flex-1">
              <button onClick={onBack} disabled={busy} className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-sm text-[var(--color-muted-foreground)] font-medium disabled:opacity-60">Cancel</button>
              <button onClick={confirm} disabled={busy || previewLoading || !preview || preview.ok === false} className="flex-1 bg-[var(--color-primary)] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60">{busy ? "Sending…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DepositScreen({ onBack, risk, accounts, onMutated }:
  { onBack: () => void; risk: RiskState; accounts: Account[]; onMutated: () => Promise<void> }) {
  const [to, setTo]         = useState("checking");
  const [amount, setAmount] = useState("");
  const [done, setDone]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const frogImg = RISK_STYLE[risk].frog;
  const sel = "w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-white appearance-none focus:outline-none focus:border-[var(--color-primary)] transition-colors";
  const toAcc = accounts.find((a) => a.id === to);

  async function confirm() {
    const parsed = parseFloat(amount);
    if (!(parsed > 0) || !toAcc || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      // No dedicated deposit endpoint yet — add to the balance via the
      // generic PATCH /cuentas edit endpoint (backend/estado.py actualizar_cuentas()).
      await editarCuentas({ [ACCOUNT_BACKEND_KEY[to as AccountId]]: toAcc.value + parsed });
      await onMutated();
      setDone(true);
    } catch {
      setErrorMsg("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return (
    <div className="px-6 pt-12 pb-24 flex flex-col items-center text-center">
      <img src={frogImg} alt="frog" className="w-24 h-24 object-contain mb-5"/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2">Deposit recorded!</p>
      <button onClick={onBack} className="text-sm font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-6 py-2.5">Back</button>
    </div>
  );

  return (
    <div className="px-6 pt-4 pb-28">
      <BackButton onBack={onBack}/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-6">Get Deposit</p>
      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] uppercase mb-1.5" style={{ letterSpacing:"0.1em" }}>Into</p>
          <div className="relative">
            <select value={to} onChange={(e) => setTo(e.target.value)} className={sel}>
              {accounts.filter((a) => a.id !== "bills").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <svg className="absolute right-3 top-3.5 text-[var(--color-muted-foreground)] pointer-events-none" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] uppercase mb-1.5" style={{ letterSpacing:"0.1em" }}>Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-sm text-[var(--color-muted-foreground)]">$</span>
            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-xl pl-8 pr-4 py-3 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
          </div>
        </div>
      </div>
      {parseFloat(amount) > 0 && (
        <div className="mt-7">
          <HairlineRule className="mb-5"/>
          <div className="flex items-end gap-3 mb-5">
            <img src={frogImg} alt="frog" className="w-11 h-11 object-contain shrink-0"/>
            <SpeechBubble className="flex-1">
              <p className="text-sm">Depositing ${parseFloat(amount).toFixed(2)} into {toAcc?.label}.</p>
            </SpeechBubble>
          </div>
          {errorMsg && <p className="text-xs font-medium text-[#c0392b] mb-3">{errorMsg}</p>}
          <button onClick={confirm} disabled={busy} className="w-full bg-[var(--color-primary)] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-60">
            {busy ? "Recording…" : "Confirm Deposit"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function HomeScreen({ risk, usuario, cuentas, riesgo, plan, goals, accountGoals, onSetGoal, accounts, onNav }: {
  risk: RiskState; usuario: Usuario; cuentas: Cuentas; riesgo: Riesgo; plan: Plan | null;
  goals: string[]; accountGoals: AccountGoals; onSetGoal: SetAccountGoal;
  accounts: Account[]; onNav: (s: Screen) => void;
}) {
  const cfg = RISK_STYLE[risk];
  const [showCR, setShowCR]         = useState(false);
  const [openAccount, setOpenAccount] = useState<AccountId | null>(null);
  const cr = creditReadiness(riesgo, plan, cuentas, goals, accountGoals);
  const checkingAcc = accounts.find((a) => a.id === "checking");
  const otherAccounts = accounts.filter((a) => a.id !== "checking");

  const safeToSave = plan ? Math.max(Math.round(plan.excedente_mensual), 0) : 0;

  // Shared sub-sections as render helpers so both layouts share the same markup

  // One static bubble with the most important facts — no rotating slides.
  const Hero = (
    <div className="flex items-start gap-3 mb-5">
      <img src={cfg.frog} alt="CapiFrog" className="w-16 h-16 lg:w-20 lg:h-20 object-contain shrink-0"/>
      <div className="flex-1 pt-1">
        <SpeechBubble>
          <FormattedText text={keyInsights(risk, riesgo, plan)}
            className="text-sm lg:text-base text-[var(--color-foreground)] leading-relaxed mb-2" />
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${cfg.badge.bg}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${cfg.badge.dot}`}/>
            <span className={`text-[11px] font-semibold ${cfg.badge.text}`}>{cfg.label}</span>
          </div>
        </SpeechBubble>
      </div>
    </div>
  );

  // Checking sits at the very top — it's the account people check most.
  const CheckingCard = checkingAcc ? (
    <button onClick={() => setOpenAccount("checking")}
      className="w-full text-left mb-5 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3.5 flex items-center justify-between hover:border-[var(--color-primary)] transition-colors">
      <div>
        <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-1" style={{ letterSpacing:"0.12em" }}>Checking</p>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">
          ${checkingAcc.value.toLocaleString("en-US",{minimumFractionDigits:checkingAcc.value%1!==0?2:0})}
        </p>
      </div>
      <Chevron/>
    </button>
  ) : null;

  const AskMe = (
    <button onClick={() => onNav("chat")} className="flex items-center gap-2 mb-5 group">
      <span className="text-[var(--color-primary)] text-sm">✧</span>
      <p className="text-sm font-medium text-[var(--color-primary)] group-hover:opacity-70 transition-opacity">Ask Me</p>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--color-primary)] opacity-50">
        <path d="M4 2L8 6l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );

  const FindHelp = (risk === "medium" || risk === "high") ? (
    <button onClick={() => onNav("help")}
      className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-5 text-left border ${
        risk==="high" ? "bg-[var(--color-danger-bg)] border-red-200" : "bg-[var(--color-warning-bg)] border-orange-200"
      }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${risk==="high"?"bg-[#c0392b]":"bg-[var(--color-warning)]"}`}>!</div>
      <p className={`flex-1 text-sm font-semibold ${risk==="high"?"text-[#c0392b]":"text-[var(--color-warning)]"}`}>Find Help Before You Need It</p>
      <Chevron/>
    </button>
  ) : null;

  const Actions = (
    <div className="flex gap-2 pt-5">
      {[
        { label:"Transfer", icon:<path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>, screen:"transfer" as Screen },
        { label:"Deposit",  icon:<path d="M8 2v12M4 10l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>, screen:"deposit"  as Screen },
        { label:"Simulate", icon:<><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6l4 2-4 2V6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></>, screen:"simulate" as Screen },
      ].map(({ label, icon, screen }) => (
        <button key={label} onClick={() => onNav(screen)}
          className="flex-1 flex flex-col items-center gap-1.5 border border-[var(--color-border)] rounded-2xl py-3.5 text-xs font-medium text-[var(--color-foreground)] bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">{icon}</svg>
          {label}
        </button>
      ))}
    </div>
  );

  // Score is derived from the same risk probability as the badge above —
  // see creditReadiness() — so the two can never disagree.
  const CRPreview = (
    <div className="mb-5">
      <HairlineRule className="mb-5"/>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-1" style={{ letterSpacing:"0.12em" }}>Credit Readiness</p>
          <div className="flex items-baseline gap-1.5 mb-1">
            <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">{cr.score}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">/ 100</p>
            <span className="text-xs font-semibold text-[#2a9d8f] ml-1">{cr.label} {cr.trend}</span>
          </div>
          <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden w-28">
            <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${cr.score}%` }}/>
          </div>
        </div>
        <button onClick={() => setShowCR(true)}
          className="text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-3 py-1.5 shrink-0">
          See Details
        </button>
      </div>
      <HairlineRule className="mt-5"/>
    </div>
  );

  // Shows only the single best next move — a goal-aware pick from topBucket()
  // — instead of ranking all three savings buckets.
  const SafeToSave = plan && plan.excedente_mensual > 0 ? (
    <>
      <HairlineRule/>
      <div className="py-5">
        <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-3" style={{ letterSpacing:"0.12em" }}>Safe to Save</p>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[#2a9d8f] mb-3">${safeToSave}</p>
        {(() => {
          const top = topBucket(plan, cuentas, goals, accountGoals);
          return (
            <div className="rounded-xl px-4 py-3 border border-[#2a9d8f] bg-[#e6f7f5]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#2a9d8f]">{top.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[#2a9d8f]">${Math.round(top.amount)}</p>
                  <span className="text-[10px] font-bold text-[#2a9d8f] bg-white px-2 py-0.5 rounded-full border border-[#2a9d8f]">Recommended</span>
                </div>
              </div>
              <p className="text-xs text-[#2a9d8f] opacity-80 mt-1">{top.reason}</p>
            </div>
          );
        })()}
      </div>
    </>
  ) : null;

  // Checking has its own card above — this list is the remaining accounts.
  const AccountsList = (
    <div className="py-4">
      {otherAccounts.map((acc, i) => (
        <div key={acc.id}>
          <button className="w-full flex items-center justify-between py-3.5 text-left"
            onClick={() => setOpenAccount(acc.id)}>
            <p className="text-sm font-medium text-[var(--color-foreground)]">{acc.label}</p>
            <div className="flex items-center gap-2">
              {acc.note && <span className="text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full">{acc.note}</span>}
              <p style={{ fontFamily:"var(--font-serif)" }} className="text-base text-[var(--color-foreground)]">
                ${acc.value.toLocaleString("en-US",{minimumFractionDigits:acc.value%1!==0?2:0})}
              </p>
              <Chevron/>
            </div>
          </button>
          {i < otherAccounts.length - 1 && <HairlineRule/>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ── Mobile layout (single column) ── */}
      <div className="lg:hidden px-6 pb-12 pt-5">
        {Hero}
        {AskMe}
        {CheckingCard}
        {CRPreview}
        {FindHelp}
        {SafeToSave}
        <HairlineRule/>
        {AccountsList}
        <HairlineRule/>
        {Actions}
      </div>

      {/* ── Desktop layout (two columns) ── */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_1fr] lg:gap-0 lg:items-start pb-16 pt-8 px-10">

        {/* Left column: hero + ask me + checking + find help + actions */}
        <div className="pr-10 border-r border-[var(--color-border)] sticky top-[73px] self-start">
          {Hero}
          {AskMe}
          {CheckingCard}
          {FindHelp}
          <HairlineRule className="mb-5"/>
          {Actions}
        </div>

        {/* Right column: credit readiness + safe to save + accounts */}
        <div className="pl-10">
          {/* CR preview without top hairline on desktop (header already provides separation) */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex-1 pr-4">
                <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-1" style={{ letterSpacing:"0.12em" }}>Credit Readiness</p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">{cr.score}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">/ 100</p>
                  <span className="text-xs font-semibold text-[#2a9d8f] ml-1">{cr.label} {cr.trend}</span>
                </div>
                <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden w-28">
                  <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${cr.score}%` }}/>
                </div>
              </div>
              <button onClick={() => setShowCR(true)}
                className="text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-3 py-1.5 shrink-0">
                See Details
              </button>
            </div>
            <HairlineRule/>
          </div>

          {SafeToSave}
          <HairlineRule/>
          {AccountsList}
        </div>
      </div>

      {/* Floating modals */}
      {showCR                       && <CreditReadinessModal onClose={() => setShowCR(false)} riesgo={riesgo} plan={plan} cuentas={cuentas} goals={goals} accountGoals={accountGoals}/>}
      {openAccount === "checking"   && <CheckingModal   onClose={() => setOpenAccount(null)} cuentas={cuentas} usuario={usuario} plan={plan} accountGoals={accountGoals} onSetGoal={onSetGoal}/>}
      {openAccount === "emergency"  && <EmergencyModal  onClose={() => setOpenAccount(null)} cuentas={cuentas} usuario={usuario} plan={plan} accountGoals={accountGoals} onSetGoal={onSetGoal}/>}
      {openAccount === "bills"      && <BillsModal      onClose={() => setOpenAccount(null)} cuentas={cuentas} accountGoals={accountGoals} onSetGoal={onSetGoal}/>}
      {openAccount === "hysa"       && <HYSAModal       onClose={() => setOpenAccount(null)} cuentas={cuentas} plan={plan} risk={risk} accountGoals={accountGoals} onSetGoal={onSetGoal}/>}
      {openAccount === "shortterm"  && <ShortTermModal  onClose={() => setOpenAccount(null)} cuentas={cuentas} plan={plan} accountGoals={accountGoals} onSetGoal={onSetGoal}/>}
    </>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cuentas, setCuentas] = useState<Cuentas | null>(null);
  const [riesgo, setRiesgo]   = useState<Riesgo | null>(null);
  const [plan, setPlan]       = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [goals, setGoals]     = useState<string[]>(() => readStoredProfile()?.goals.goals ?? []);
  const [accountGoals, setAccountGoals] = useState<AccountGoals>(() => readAccountGoals());
  const [showProfileFlow, setShowProfileFlow] = useState(false);

  function onSetGoal(key: keyof Cuentas, amount: number | null) {
    setAccountGoals((prev) => {
      const next = { ...prev };
      if (amount != null && amount > 0) next[key] = amount; else delete next[key];
      writeAccountGoals(next);
      return next;
    });
  }

  // Pull a fresh snapshot from the backend. Used on initial load and again
  // after any action that mutates state server-side (transfer, deposit,
  // preset switch, profile edit) — backend/main.py bundles
  // usuario+cuentas+riesgo together, but the derived savings plan comes from
  // a separate call.
  async function refrescar() {
    const u = await getUsuario(); // GET /usuario
    setUsuario(u.usuario);
    setCuentas(u.cuentas);
    setRiesgo(u.riesgo);
    try {
      const r = await getRevision(); // GET /revision — backend/plan.py plan_ahorro()
      setPlan(r.plan);
    } catch {
      setPlan(null);
    }
  }

  // Pushes the one onboarding answer with a real backend counterpart
  // (income predictability → estabilidad_ingreso) via PATCH /usuario.
  async function applyProfile(answers: ProfileAnswers) {
    try {
      await editarUsuario({ estabilidad_ingreso: estimateEstabilidad(answers.predictability) });
    } catch {
      // best-effort — a stale estabilidad_ingreso just means predictions
      // don't reflect the latest answer yet; not worth blocking the UI on.
    }
  }

  async function handleProfileComplete(answers: ProfileAnswers) {
    storeProfile(answers);
    setGoals(answers.goals.goals);
    setShowProfileFlow(false);
    setLoading(true);
    await applyProfile(answers);
    await refrescar();
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = readStoredProfile();
        if (stored) await applyProfile(stored);
        await refrescar();
        if (alive) setError(null);
      } catch {
        if (alive) setError("Can't reach the CapiFrog server. Is the backend running on localhost:8000?");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const risk: RiskState = riesgo ? NIVEL_TO_RISK[riesgo.nivel] : "stable";
  const accounts = cuentas ? buildAccounts(cuentas, plan) : [];

  // Dev toggle: tap logo 5× to cycle demo presets (backend/mock_user.py PRESETS)
  const devTaps    = useRef(0);
  const devTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const presetIdx  = useRef(0);
  function handleLogoTap() {
    devTaps.current++;
    clearTimeout(devTimer.current);
    devTimer.current = setTimeout(() => { devTaps.current = 0; }, 1500);
    if (devTaps.current >= 5) {
      devTaps.current = 0;
      presetIdx.current = (presetIdx.current + 1) % PRESET_CYCLE.length;
      aplicarPreset(PRESET_CYCLE[presetIdx.current]) // POST /preset/{nombre}
        .then(() => refrescar())
        .catch(() => {});
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor:"var(--color-background)" }}>
        <img src={frogStable} alt="CapiFrog" className="w-16 h-16 object-contain animate-pulse"/>
        <p className="text-sm text-[var(--color-muted-foreground)]">Loading CapiFrog…</p>
      </div>
    );
  }

  if (error || !usuario || !cuentas || !riesgo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ backgroundColor:"var(--color-background)" }}>
        <img src={frogHigh} alt="CapiFrog" className="w-16 h-16 object-contain"/>
        <p className="text-sm text-[var(--color-foreground)] max-w-xs">{error ?? "Something went wrong loading your data."}</p>
        <button onClick={() => { setLoading(true); refrescar().then(() => setError(null)).catch(() => setError("Still can't reach the server.")).finally(() => setLoading(false)); }}
          className="text-sm font-medium text-white bg-[var(--color-primary)] rounded-full px-6 py-2.5">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor:"var(--color-background)" }}>
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] px-6 py-3.5 flex items-center justify-between"
        style={{ backgroundColor:"var(--color-background)" }}>
        <button onClick={() => setShowProfileFlow(true)} aria-label="Edit your profile" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="4.5" r="2.5" stroke="var(--color-primary)" strokeWidth="1.2"/>
              <path d="M1.5 13c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" stroke="var(--color-primary)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] font-medium">{usuario.nombre}</p>
        </button>
        <img src={capitalOneLogo} alt="Capital One" className="h-6 object-contain cursor-pointer select-none"
          onClick={handleLogoTap}/>
      </header>

      {/* Home screen uses its own responsive grid; secondary screens stay centered narrow */}
      {screen === "home" ? (
        <main className="max-w-md lg:max-w-4xl mx-auto">
          <HomeScreen risk={risk} usuario={usuario} cuentas={cuentas} riesgo={riesgo} plan={plan} goals={goals}
            accountGoals={accountGoals} onSetGoal={onSetGoal} accounts={accounts} onNav={setScreen}/>
        </main>
      ) : (
        <main className="max-w-md lg:max-w-xl mx-auto lg:px-0">
          {screen === "chat"     && <ChatScreen     onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "help"     && <HelpScreen     onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "simulate" && <SimulateScreen onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "transfer" && <TransferScreen onBack={() => setScreen("home")} risk={risk} accounts={accounts} onMutated={refrescar}/>}
          {screen === "deposit"  && <DepositScreen  onBack={() => setScreen("home")} risk={risk} accounts={accounts} onMutated={refrescar}/>}
        </main>
      )}

      {showProfileFlow && (
        <ProfileUpdateFlow onCancel={() => setShowProfileFlow(false)} onComplete={handleProfileComplete}/>
      )}
    </div>
  );
}
