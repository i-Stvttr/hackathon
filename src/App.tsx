import { useState, useRef, useEffect } from "react";
import capitalOneLogo from "@/imports/image-3.png";
import frogStable     from "@/imports/image-5.png";
import frogMedium     from "@/imports/MONEY_GETTING_TIGHT_.jpeg";
import frogHigh       from "@/imports/SAVINGS.jpeg";

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskState = "stable" | "medium" | "high";
type Screen    = "home" | "transfer" | "deposit" | "simulate" | "chat" | "help";
type AccountId = "checking" | "emergency" | "bills" | "hysa" | "shortterm";

// ─── Risk config ──────────────────────────────────────────────────────────────
const RISK_INSIGHTS: Record<RiskState, string[]> = {
  stable: [
    "You're on track this week.",
    "$80 is safe to save.",
    "Your routine bills are covered.",
    "High-Yield Savings is earning for you.",
  ],
  medium: [
    "Things may get tight soon.",
    "Rent is due before your next paycheck.",
    "This week is tighter than usual.",
    "Consider pausing unused subscriptions.",
  ],
  high: [
    "Your finances need attention.",
    "Prioritize rent and essential bills.",
    "Check your emergency fund options.",
    "Reach out for support if needed.",
  ],
};

const RISK = {
  stable: {
    frog: frogStable,
    label: "Stable",
    badge: { dot: "bg-[#2a9d8f]", text: "text-[#2a9d8f]", bg: "bg-[#e6f7f5]" },
    safeToSave: 80,
    saveTo: "High-Yield Savings",
    cushionWeeks: 6.2,
  },
  medium: {
    frog: frogMedium,
    label: "Medium Risk",
    badge: { dot: "bg-[#c4834a]", text: "text-[#c4834a]", bg: "bg-[#fef6ee]" },
    safeToSave: 0,
    saveTo: "Emergency Fund",
    cushionWeeks: 1.8,
  },
  high: {
    frog: frogHigh,
    label: "High Risk",
    badge: { dot: "bg-[#c0392b]", text: "text-[#c0392b]", bg: "bg-[#fdf0ef]" },
    safeToSave: 0,
    saveTo: null,
    cushionWeeks: 0.4,
  },
};

// ─── Credit Readiness data ────────────────────────────────────────────────────
const MONTHS  = ["J","F","M","A","M","J","J","A","S","O","N","D"];
const MONTHLY_INCOME   = [2100,1400,2800,1600,3200,2400,1200,2700,1900,3100,2200,2600];
const MONTHLY_EXPENSES = [1780,1750,1820,1780,1860,1830,1700,1840,1760,1890,1810,1870];
const AVG_INCOME   = Math.round(MONTHLY_INCOME.reduce((a,b)=>a+b,0)/12);
const AVG_EXPENSES = Math.round(MONTHLY_EXPENSES.reduce((a,b)=>a+b,0)/12);
const AVG_REMAINING = AVG_INCOME - AVG_EXPENSES;
const CR_SCORE = 76;
const CR_LABEL = "Building Strongly";
const CR_ACTION = "Add $300 to your Rainy Day Fund.";

// ─── Accounts ─────────────────────────────────────────────────────────────────
const ACCOUNTS: { id: AccountId; label: string; value: number; note?: string }[] = [
  { id: "checking",  label: "Checking",           value: 2847.60 },
  { id: "emergency", label: "Emergency Fund",      value: 1200,  note: "$1,800 to goal" },
  { id: "bills",     label: "Routine Bills",       value: 1488,  note: "2 unpaid" },
  { id: "hysa",      label: "High-Yield Savings",  value: 3400 },
  { id: "shortterm", label: "Short-term Savings",  value: 620 },
];

// ─── Chat data ────────────────────────────────────────────────────────────────
const CHAT_RESPONSES: Record<string, string> = {
  "why am i stable":            "Bills covered before payday, 6+ weeks of cushion, savings growing.",
  "why medium risk":            "Rent and electric are due before Sep 20, leaving a thin buffer.",
  "why high risk":              "Balance minus upcoming bills leaves less than a week of cushion.",
  "why save $80":               "After bills and a safety buffer, $80 remains without stress.",
  "where should i save":        "High-Yield Savings at 4.6% APY when stable. Emergency Fund when stressed.",
  "what is rainy day fund":     "Your buffer for unexpected costs. Goal: ~$3,000 (1 month of expenses).",
  "how long will my money last":"At current spending, about 6.2 weeks of cushion.",
  "default":                    "Try: 'Why am I stable?' or 'Where should I save?'",
};

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
function CheckingModal({ onClose }: { onClose: () => void }) {
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Checking" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-4">$2,847.60</p>
        <HairlineRule className="mb-1" />
        <StatRow label="Avg monthly income"   value={`$${AVG_INCOME.toLocaleString()}`} />
        <HairlineRule />
        <StatRow label="Avg monthly spending" value={`$${AVG_EXPENSES.toLocaleString()}`} />
        <HairlineRule />
        <StatRow label="Safe to use"          value="$80"  accent />
      </div>
    </FloatingModal>
  );
}

function EmergencyModal({ onClose }: { onClose: () => void }) {
  const pct = Math.round((1200/3000)*100);
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Emergency Fund" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-1">$1,200</p>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4">of $3,000 goal</p>
        <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-4">
          <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${pct}%` }}/>
        </div>
        <HairlineRule className="mb-1" />
        <StatRow label="Progress"         value={`${pct}%`} />
        <HairlineRule />
        <StatRow label="Covers essentials" value="~2.4 weeks" />
        <HairlineRule />
        <StatRow label="Next contribution" value="$80" accent />
      </div>
    </FloatingModal>
  );
}

function BillsModal({ onClose }: { onClose: () => void }) {
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
          <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)]">$1,488</p>
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
      </div>
    </FloatingModal>
  );
}

function HYSAModal({ onClose, risk }: { onClose: () => void; risk: RiskState }) {
  const recommended = risk === "stable";
  const yearly = Math.round(3400 * 0.046);
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="High-Yield Savings" onClose={onClose} />
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-4">$3,400</p>
        <HairlineRule className="mb-1" />
        <StatRow label="APY"                    value="4.6%" />
        <HairlineRule />
        <StatRow label="Est. yearly earnings"   value={`$${yearly}`} accent />
        <HairlineRule />
        <div className="pt-2.5">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {recommended
              ? "Best place for idle cash right now — earning above inflation."
              : "When stable again, move surplus here first."}
          </p>
        </div>
      </div>
    </FloatingModal>
  );
}

function ShortTermModal({ onClose }: { onClose: () => void }) {
  const pct = Math.round((620/1000)*100);
  const monthsLeft = Math.ceil((1000-620)/80);
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Short-term Savings" onClose={onClose} />
        <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1 uppercase" style={{ letterSpacing:"0.1em" }}>Vacation Fund</p>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[var(--color-foreground)] mb-1">$620</p>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4">of $1,000 goal</p>
        <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-4">
          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width:`${pct}%` }}/>
        </div>
        <HairlineRule className="mb-1" />
        <StatRow label="Progress"         value={`${pct}%`} />
        <HairlineRule />
        <StatRow label="Est. time to goal" value={`~${monthsLeft} months`} accent />
      </div>
    </FloatingModal>
  );
}

// ─── Credit Readiness modal ───────────────────────────────────────────────────
function CreditReadinessModal({ onClose }: { onClose: () => void }) {
  return (
    <FloatingModal onClose={onClose}>
      <div className="px-6 pt-6 pb-6">
        <ModalHeader label="Credit Readiness" onClose={onClose} />

        {/* Score */}
        <div className="flex items-baseline gap-2 mb-1">
          <p style={{ fontFamily:"var(--font-serif)" }} className="text-5xl text-[var(--color-foreground)]">{CR_SCORE}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">/ 100</p>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2a9d8f]"/>
          <p className="text-xs font-semibold text-[#2a9d8f]">{CR_LABEL} ↑</p>
        </div>
        <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden mt-3 mb-4">
          <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${CR_SCORE}%` }}/>
        </div>

        {/* Legend + chart */}
        <div className="flex items-center gap-4 mb-2">
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
            <span className="w-2 h-1.5 rounded-sm inline-block bg-[#2a9d8f] opacity-70"/>Ingresos
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted-foreground)]">
            <span className="w-2 h-1.5 rounded-sm inline-block bg-[#004977] opacity-30"/>Gastos
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
          <p className="text-xs font-medium text-[#2a9d8f]">{CR_ACTION}</p>
        </div>
      </div>
    </FloatingModal>
  );
}

// ─── Chat screen ──────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "frog"; text: string };

function ChatScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg = RISK[risk];
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role:"frog", text:`Hi! Ask me anything about your finances.` },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    risk === "stable" ? "Why am I stable?" : risk === "medium" ? "Why medium risk?" : "Why high risk?",
    "Why save $80?",
    "Where should I save?",
    "How long will my money last?",
  ];

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const key    = q.toLowerCase().replace(/[?!.]/g, "");
    const answer = CHAT_RESPONSES[key] ?? CHAT_RESPONSES["default"];
    setMsgs((m) => [...m, { role:"user", text:q }, { role:"frog", text:answer }]);
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-57px)]">
      <div className="px-6 pt-2 pb-2 border-b border-[var(--color-border)] flex items-center gap-3">
        <BackButton onBack={onBack} />
        <img src={cfg.frog} alt="frog" className="w-8 h-8 object-contain"/>
        <p className="text-sm font-medium text-[var(--color-foreground)]">Ask CapFrog</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {m.role === "frog" && <img src={cfg.frog} alt="frog" className="w-8 h-8 object-contain shrink-0 self-end"/>}
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === "frog"
                ? "bg-white border border-[var(--color-border)] text-[var(--color-foreground)] rounded-bl-sm"
                : "bg-[var(--color-primary)] text-white rounded-br-sm"
            }`}>{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto">
        {suggestions.map((s) => (
          <button key={s} onClick={() => send(s)}
            className="shrink-0 text-[11px] font-medium bg-[var(--color-secondary)] text-[var(--color-primary)] px-3 py-1.5 rounded-full border border-[var(--color-border)]">
            {s}
          </button>
        ))}
      </div>
      <div className="px-4 pb-5 pt-2 border-t border-[var(--color-border)] flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your finances…"
          className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"/>
        <button onClick={() => send(input)} className="bg-[var(--color-primary)] text-white rounded-xl px-4 py-2.5 text-sm font-medium">Send</button>
      </div>
    </div>
  );
}

// ─── Help screen ──────────────────────────────────────────────────────────────
function HelpScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg = RISK[risk];
  const [trustedSent, setTrustedSent] = useState(false);
  const [showResources, setShowResources] = useState(false);

  const riskReasons: Record<RiskState, string[]> = {
    stable: [],
    medium: ["Rent ($1,200) and electric ($78) due before Sep 20 paycheck.", "Gym subscription unused 6+ weeks.", "Emergency fund at 40% of goal."],
    high:   ["Balance minus bills leaves under $200.", "No income expected for 8+ days.", "Subscriptions consuming $130/mo."],
  };
  const scenarios = risk === "high" ? [
    { label:"Miss a paycheck",   impact:"Bills likely go unpaid — overdraft risk" },
    { label:"Emergency expense", impact:"Checking hits zero — no safety net" },
    { label:"Income loss",       impact:"Critical — immediate action required" },
  ] : [
    { label:"Miss a paycheck",   impact:"Bills covered but buffer drops to ~$89" },
    { label:"Emergency expense", impact:"Dips into emergency fund" },
    { label:"Extra spending",    impact:"Risk level could move to High" },
  ];
  const steps = risk === "high" ? [
    "Contact landlord before rent is due",
    "Pause all non-essential subscriptions",
    "Move available cash to Emergency Fund",
    "Review Capital One hardship options",
  ] : [
    "Skip non-essential purchases this week",
    "Cancel or pause unused subscriptions",
    "Hold transfers out of checking",
  ];

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

      <div className="mb-4 space-y-2">
        {riskReasons[risk].map((r, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className={`text-xs font-bold mt-0.5 ${cfg.badge.text}`}>!</span>
            <p className="text-sm text-[var(--color-foreground)]">{r}</p>
          </div>
        ))}
      </div>

      <HairlineRule className="my-4"/>

      <div className="flex items-baseline gap-2 mb-2">
        <p style={{ fontFamily:"var(--font-serif)" }} className={`text-4xl ${cfg.badge.text}`}>{cfg.cushionWeeks.toFixed(1)}</p>
        <p className="text-sm text-[var(--color-muted-foreground)]">weeks cushion</p>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden mb-4">
        <div className="h-full rounded-full" style={{ width:`${Math.min(100,(cfg.cushionWeeks/8)*100)}%`,
          backgroundColor: risk==="stable"?"#2a9d8f":risk==="medium"?"#c4834a":"#c0392b" }}/>
      </div>

      <HairlineRule className="my-4"/>

      <div className="space-y-2 mb-4">
        {scenarios.map((s) => (
          <div key={s.label} className="bg-[var(--color-muted)] rounded-xl p-3">
            <p className="text-sm font-medium text-[var(--color-foreground)]">{s.label}</p>
            <p className={`text-xs font-medium mt-0.5 ${cfg.badge.text}`}>{s.impact}</p>
          </div>
        ))}
      </div>

      <HairlineRule className="my-4"/>

      <div className="space-y-2 mb-5">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
              style={{ backgroundColor: risk==="stable"?"#2a9d8f":risk==="medium"?"#c4834a":"#c0392b" }}>
              {i+1}
            </div>
            <p className="text-sm text-[var(--color-foreground)] pt-0.5">{s}</p>
          </div>
        ))}
      </div>

      {risk === "high" && (
        <div className="space-y-3">
          {!trustedSent ? (
            <button onClick={() => setTrustedSent(true)}
              className="w-full flex items-center justify-center gap-2 border border-[var(--color-border)] rounded-2xl py-4 text-sm font-medium text-[var(--color-foreground)] bg-white">
              Notify a Trusted Person
            </button>
          ) : (
            <div className="w-full border border-[#2a9d8f] bg-[#e6f7f5] rounded-2xl py-4 flex items-center justify-center text-sm font-medium text-[#2a9d8f]">
              ✓ Trusted contact notified
            </div>
          )}
          <button onClick={() => setShowResources((v) => !v)}
            className="w-full flex items-center justify-between border border-[var(--color-border)] rounded-2xl px-5 py-4 text-sm font-medium text-[var(--color-foreground)] bg-white">
            View Assistance Resources <Chevron/>
          </button>
          {showResources && (
            <div className="bg-[var(--color-muted)] rounded-2xl p-4 space-y-3">
              {[["211.org","Local financial & food help"],["LIHEAP","Energy bill assistance"],["SNAP Benefits","Food assistance"],["Capital One Hardship","Payment plan options"]].map(([n,d]) => (
                <div key={n} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{n}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{d}</p>
                  </div>
                  <Chevron/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Simulate screen ──────────────────────────────────────────────────────────
const SIM_OPTIONS = {
  spend: { label:"Spend Now", pros:["Immediate need met"], cons:["Reduces buffer","No interest"], risk:"Medium", opp:"None this cycle" },
  delay: { label:"Delay",     pros:["Buys time"],          cons:["Possible late fees"],           risk:"Medium–High", opp:"Next paycheck covers it" },
  save:  { label:"Save",      pros:["Builds cushion","4.6% APY"], cons:["Less liquid now"],       risk:"Low", opp:"Compound growth" },
};
type SimKey = keyof typeof SIM_OPTIONS;

function SimulateScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const cfg    = RISK[risk];
  const [amount, setAmount] = useState("");
  const [active, setActive] = useState<SimKey>("save");
  const d      = SIM_OPTIONS[active];
  const parsed = parseFloat(amount) || 0;
  const checkingAfter = 2847.60 - (active === "spend" ? parsed : 0);
  const cushionAfter  = active === "save" ? cfg.cushionWeeks + parsed/500 : active === "delay" ? cfg.cushionWeeks - 0.3 : cfg.cushionWeeks - parsed/800;

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
        {(Object.keys(SIM_OPTIONS) as SimKey[]).map((k) => (
          <button key={k} onClick={() => setActive(k)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${active===k?"bg-white text-[var(--color-primary)] shadow-sm":"text-[var(--color-muted-foreground)]"}`}>
            {SIM_OPTIONS[k].label}
          </button>
        ))}
      </div>
      <div className="space-y-3 mb-5">
        <div className="flex gap-3">
          <div className="flex-1 bg-[#e6f7f5] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[#2a9d8f] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Pros</p>
            {d.pros.map((p) => <p key={p} className="text-xs text-[var(--color-foreground)] mb-1">↑ {p}</p>)}
          </div>
          <div className="flex-1 bg-[var(--color-warning-bg)] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[var(--color-warning)] uppercase mb-2" style={{ letterSpacing:"0.08em" }}>Cons</p>
            {d.cons.map((c) => <p key={c} className="text-xs text-[var(--color-foreground)] mb-1">↓ {c}</p>)}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 bg-[var(--color-muted)] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase mb-1" style={{ letterSpacing:"0.08em" }}>Risk</p>
            <p className="text-sm font-medium text-[var(--color-foreground)]">{d.risk}</p>
          </div>
          <div className="flex-1 bg-[var(--color-secondary)] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[var(--color-primary)] uppercase mb-1" style={{ letterSpacing:"0.08em" }}>Opportunity</p>
            <p className="text-xs text-[var(--color-foreground)]">{d.opp}</p>
          </div>
        </div>
      </div>
      {parsed > 0 && (
        <>
          <HairlineRule className="mb-4"/>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">Checking after</p>
              <p style={{ fontFamily:"var(--font-serif)" }} className="text-base text-[var(--color-foreground)]">
                ${Math.max(0,checkingAfter).toLocaleString("en-US",{minimumFractionDigits:2})}
              </p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">Cushion estimate</p>
              <p className={`text-base font-semibold ${cushionAfter>=4?"text-[#2a9d8f]":cushionAfter>=2?"text-[var(--color-warning)]":"text-[#c0392b]"}`}>
                {Math.max(0,cushionAfter).toFixed(1)} weeks
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Transfer / Deposit screens ───────────────────────────────────────────────
function getReview(from: string, to: string, amount: number) {
  const fromAcc  = ACCOUNTS.find((a) => a.id === from);
  const remaining = (fromAcc?.value ?? 0) - amount;
  if (to === "emergency") return { summary:`Moving $${amount} to Emergency Fund.`, pros:["Builds safety net"], cons:[`Checking → $${remaining.toFixed(0)}`] };
  if (to === "hysa")      return { summary:`$${amount} earning 4.6% APY immediately.`, pros:["Earns interest","FDIC insured"], cons:[`Checking → $${remaining.toFixed(0)}`] };
  return { summary:`Transferring $${amount} from ${fromAcc?.label}.`, pros:["Intentional move"], cons:[`Checking → $${remaining.toFixed(0)}`] };
}

function TransferScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const [from, setFrom] = useState("checking");
  const [to, setTo]     = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const isReady = from && to && to !== from && parseFloat(amount) > 0;
  const review  = isReady ? getReview(from, to, parseFloat(amount)) : null;
  const frogImg = RISK[risk].frog;
  const sel = "w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-white appearance-none focus:outline-none focus:border-[var(--color-primary)] transition-colors";

  if (done) return (
    <div className="px-6 pt-12 pb-24 flex flex-col items-center text-center">
      <img src={frogImg} alt="frog" className="w-24 h-24 object-contain mb-5"/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-2">Transfer sent!</p>
      <button onClick={onBack} className="text-sm font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-6 py-2.5">Back</button>
    </div>
  );

  return (
    <div className="px-6 pt-4 pb-28">
      <BackButton onBack={onBack}/>
      <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)] mb-6">Transfer</p>
      <div className="space-y-4">
        {[{lbl:"From",val:from,set:setFrom,opts:ACCOUNTS.filter((a)=>a.id!=="bills"),bal:true},
          {lbl:"To",  val:to,  set:setTo,  opts:ACCOUNTS.filter((a)=>a.id!==from&&a.id!=="bills"),bal:false}
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
      {isReady && review && (
        <div className="mt-7">
          <HairlineRule className="mb-5"/>
          <SpeechBubbleDown className="mb-4">
            <p className="text-sm text-[var(--color-foreground)] mb-2">{review.summary}</p>
            {review.pros.map((p) => <p key={p} className="text-xs text-[#2a9d8f]">↑ {p}</p>)}
            {review.cons.map((c) => <p key={c} className="text-xs text-[var(--color-warning)]">↓ {c}</p>)}
          </SpeechBubbleDown>
          <div className="flex items-end gap-3">
            <img src={frogImg} alt="frog" className="w-11 h-11 object-contain shrink-0"/>
            <div className="flex gap-2 flex-1">
              <button onClick={onBack} className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-sm text-[var(--color-muted-foreground)] font-medium">Cancel</button>
              <button onClick={() => setDone(true)} className="flex-1 bg-[var(--color-primary)] text-white rounded-xl py-3 text-sm font-medium">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DepositScreen({ onBack, risk }: { onBack: () => void; risk: RiskState }) {
  const [to, setTo]     = useState("checking");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const frogImg = RISK[risk].frog;
  const sel = "w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-white appearance-none focus:outline-none focus:border-[var(--color-primary)] transition-colors";

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
              {ACCOUNTS.filter((a) => a.id !== "bills").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
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
              <p className="text-sm">Depositing ${parseFloat(amount).toFixed(2)} into {ACCOUNTS.find((a)=>a.id===to)?.label}.</p>
            </SpeechBubble>
          </div>
          <button onClick={() => setDone(true)} className="w-full bg-[var(--color-primary)] text-white rounded-xl py-3 text-sm font-medium">Confirm Deposit</button>
        </div>
      )}
    </div>
  );
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function HomeScreen({ risk, onNav }: { risk: RiskState; onNav: (s: Screen) => void }) {
  const cfg = RISK[risk];
  const insights = RISK_INSIGHTS[risk];
  const [insightIdx, setInsightIdx] = useState(0);
  const [fade, setFade]             = useState(true);
  const [showCR, setShowCR]         = useState(false);
  const [openAccount, setOpenAccount] = useState<AccountId | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setInsightIdx((i) => (i + 1) % insights.length);
        setFade(true);
      }, 250);
    }, 4000);
    return () => clearInterval(t);
  }, [insights]);

  // Shared sub-sections as render helpers so both layouts share the same markup

  const Hero = (
    <div className="flex items-start gap-3 mb-5">
      <img src={cfg.frog} alt="CapFrog" className="w-16 h-16 lg:w-20 lg:h-20 object-contain shrink-0"/>
      <div className="flex-1 pt-1">
        <SpeechBubble>
          <div style={{ height: "2.6rem" }} className="flex items-center mb-2">
            <p style={{ fontFamily:"var(--font-serif)", opacity: fade ? 1 : 0, transition:"opacity 0.25s ease" }}
               className="text-base lg:text-lg text-[var(--color-foreground)] leading-snug">
              {insights[insightIdx]}
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${cfg.badge.bg}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${cfg.badge.dot}`}/>
            <span className={`text-[11px] font-semibold ${cfg.badge.text}`}>{cfg.label}</span>
          </div>
          <div className="flex gap-1 mt-2">
            {insights.map((_, i) => (
              <div key={i} className="rounded-full transition-all" style={{
                width: i === insightIdx ? 10 : 5, height: 5,
                backgroundColor: i === insightIdx ? "var(--color-primary)" : "var(--color-border)",
              }}/>
            ))}
          </div>
        </SpeechBubble>
      </div>
    </div>
  );

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

  const CRPreview = (
    <div className="mb-5">
      <HairlineRule className="mb-5"/>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-1" style={{ letterSpacing:"0.12em" }}>Credit Readiness</p>
          <div className="flex items-baseline gap-1.5 mb-1">
            <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">{CR_SCORE}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">/ 100</p>
            <span className="text-xs font-semibold text-[#2a9d8f] ml-1">{CR_LABEL} ↑</span>
          </div>
          <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden w-28">
            <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${CR_SCORE}%` }}/>
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

  const FinancialReview = cfg.safeToSave > 0 ? (
    <>
      <HairlineRule/>
      <div className="py-5">
        <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-3" style={{ letterSpacing:"0.12em" }}>Financial Review</p>
        <p style={{ fontFamily:"var(--font-serif)" }} className="text-4xl text-[#2a9d8f] mb-3">${cfg.safeToSave}</p>
        <div className="space-y-2">
          {[
            { id:"emergency", label:"Rainy Day Fund",     active: cfg.saveTo === "Emergency Fund" },
            { id:"hysa",      label:"High-Yield Savings", active: cfg.saveTo === "High-Yield Savings" },
            { id:"shortterm", label:"Short-term Savings", active: cfg.saveTo === "Short-Term Savings" },
          ].map((opt) => (
            <div key={opt.id} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${opt.active?"border-[#2a9d8f] bg-[#e6f7f5]":"border-[var(--color-border)] bg-[var(--color-muted)]"}`}>
              <p className={`text-sm font-medium ${opt.active?"text-[#2a9d8f]":"text-[var(--color-foreground)]"}`}>{opt.label}</p>
              {opt.active && <span className="text-[10px] font-bold text-[#2a9d8f] bg-white px-2 py-0.5 rounded-full border border-[#2a9d8f]">Recommended</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  ) : null;

  const AccountsList = (
    <div className="py-4">
      {ACCOUNTS.map((acc, i) => (
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
          {i < ACCOUNTS.length - 1 && <HairlineRule/>}
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
        {CRPreview}
        {FindHelp}
        {FinancialReview}
        <HairlineRule/>
        {AccountsList}
        <HairlineRule/>
        {Actions}
      </div>

      {/* ── Desktop layout (two columns) ── */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_1fr] lg:gap-0 lg:items-start pb-16 pt-8 px-10">

        {/* Left column: hero + ask me + find help + actions */}
        <div className="pr-10 border-r border-[var(--color-border)] sticky top-[73px] self-start">
          {Hero}
          {AskMe}
          {FindHelp}
          <HairlineRule className="mb-5"/>
          {Actions}
        </div>

        {/* Right column: credit readiness + financial review + accounts */}
        <div className="pl-10">
          {/* CR preview without top hairline on desktop (header already provides separation) */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex-1 pr-4">
                <p className="text-[10px] font-semibold uppercase text-[var(--color-muted-foreground)] mb-1" style={{ letterSpacing:"0.12em" }}>Credit Readiness</p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <p style={{ fontFamily:"var(--font-serif)" }} className="text-2xl text-[var(--color-foreground)]">{CR_SCORE}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">/ 100</p>
                  <span className="text-xs font-semibold text-[#2a9d8f] ml-1">{CR_LABEL} ↑</span>
                </div>
                <div className="h-0.5 rounded-full bg-[var(--color-muted)] overflow-hidden w-28">
                  <div className="h-full rounded-full bg-[#2a9d8f]" style={{ width:`${CR_SCORE}%` }}/>
                </div>
              </div>
              <button onClick={() => setShowCR(true)}
                className="text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-border)] rounded-full px-3 py-1.5 shrink-0">
                See Details
              </button>
            </div>
            <HairlineRule/>
          </div>

          {FinancialReview}
          <HairlineRule/>
          {AccountsList}
        </div>
      </div>

      {/* Floating modals */}
      {showCR                       && <CreditReadinessModal onClose={() => setShowCR(false)}/>}
      {openAccount === "checking"   && <CheckingModal   onClose={() => setOpenAccount(null)}/>}
      {openAccount === "emergency"  && <EmergencyModal  onClose={() => setOpenAccount(null)}/>}
      {openAccount === "bills"      && <BillsModal      onClose={() => setOpenAccount(null)}/>}
      {openAccount === "hysa"       && <HYSAModal       onClose={() => setOpenAccount(null)} risk={risk}/>}
      {openAccount === "shortterm"  && <ShortTermModal  onClose={() => setOpenAccount(null)}/>}
    </>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [risk, setRisk]     = useState<RiskState>("stable");

  // Dev toggle: tap logo 5× to cycle states
  const devTaps  = useRef(0);
  const devTimer = useRef<ReturnType<typeof setTimeout>>();
  function handleLogoTap() {
    devTaps.current++;
    clearTimeout(devTimer.current);
    devTimer.current = setTimeout(() => { devTaps.current = 0; }, 1500);
    if (devTaps.current >= 5) {
      devTaps.current = 0;
      setRisk((r) => r === "stable" ? "medium" : r === "medium" ? "high" : "stable");
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor:"var(--color-background)" }}>
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] px-6 py-3.5 flex items-center justify-between"
        style={{ backgroundColor:"var(--color-background)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="4.5" r="2.5" stroke="var(--color-primary)" strokeWidth="1.2"/>
              <path d="M1.5 13c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" stroke="var(--color-primary)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] font-medium">Alex Rivera</p>
        </div>
        <img src={capitalOneLogo} alt="Capital One" className="h-6 object-contain cursor-pointer select-none"
          onClick={handleLogoTap}/>
      </header>

      {/* Home screen uses its own responsive grid; secondary screens stay centered narrow */}
      {screen === "home" ? (
        <main className="max-w-md lg:max-w-4xl mx-auto">
          <HomeScreen risk={risk} onNav={setScreen}/>
        </main>
      ) : (
        <main className="max-w-md lg:max-w-xl mx-auto lg:px-0">
          {screen === "chat"     && <ChatScreen     onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "help"     && <HelpScreen     onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "simulate" && <SimulateScreen onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "transfer" && <TransferScreen onBack={() => setScreen("home")} risk={risk}/>}
          {screen === "deposit"  && <DepositScreen  onBack={() => setScreen("home")} risk={risk}/>}
        </main>
      )}
    </div>
  );
}
