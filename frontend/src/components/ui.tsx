import { AlertCircle, Loader2, Mic, Square, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rise rounded-3xl border border-line bg-surface p-5 shadow-card backdrop-blur-xl sm:p-6 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon size={18} strokeWidth={2.2} />
              </span>
            )}
            <div>
              {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
              {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonProps = {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  variant?: "primary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
};

const VARIANTS = {
  primary: "gradient-bg text-white shadow-lg shadow-[var(--accent-soft)] hover:brightness-110",
  soft: "bg-accent-soft text-accent hover:brightness-110",
  ghost: "border border-line bg-surface-solid/40 text-ink hover:bg-surface-2",
  danger: "bg-critical text-white hover:brightness-110",
};

export function Button({ children, onClick, disabled, icon: Icon, variant = "ghost", size = "md", type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${VARIANTS[variant]}`}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

/** Pill record toggle for card headers. */
export function RecordButton({
  recording,
  disabled,
  onClick,
  idleLabel = "Record",
  activeLabel = "Stop",
}: {
  recording: boolean;
  disabled?: boolean;
  onClick: () => void;
  idleLabel?: string;
  activeLabel?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} variant={recording ? "danger" : "primary"} icon={recording ? Square : Mic}>
      {recording ? activeLabel : idleLabel}
    </Button>
  );
}

/** Large circular mic button with pulsing rings while recording; `level` (0..1) makes it breathe. */
export function MicButton({
  recording,
  busy,
  level = 0,
  disabled,
  onClick,
  label,
}: {
  recording: boolean;
  busy?: boolean;
  level?: number;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className="group relative grid h-24 w-24 place-items-center rounded-full disabled:opacity-50"
    >
      {recording && (
        <>
          <span className="mic-ring absolute inset-0 rounded-full gradient-bg" />
          <span className="mic-ring absolute inset-0 rounded-full gradient-bg" style={{ animationDelay: "0.9s" }} />
        </>
      )}
      <span
        className={`relative grid h-24 w-24 place-items-center rounded-full text-white shadow-xl transition-transform duration-75 group-active:scale-95 ${
          recording ? "bg-critical shadow-[0_10px_40px_-10px_var(--critical)]" : "gradient-bg shadow-[0_10px_40px_-10px_var(--accent)]"
        }`}
        style={{ transform: recording ? `scale(${1 + level * 0.18})` : undefined }}
      >
        {busy ? (
          <Loader2 size={34} className="animate-spin" />
        ) : recording ? (
          <Square size={28} fill="currentColor" />
        ) : (
          <Mic size={36} strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

/** Status band for a 0–100 score; always shown with a text label, never color alone. */
export function scoreBand(score: number) {
  if (score >= 80) return { label: "Excellent", color: "var(--good)" };
  if (score >= 55) return { label: "Good try", color: "var(--warning)" };
  return { label: "Needs work", color: "var(--critical)" };
}

export function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: band.color }} />
      <span className="tabular">{Math.round(score)}</span>
      <span className="sr-only">{band.label}</span>
    </span>
  );
}

export function ScoreRing({ score, size = 132, caption }: { score: number; size?: number; caption?: string }) {
  const band = scoreBand(score);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={band.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.2,.7,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-4xl font-bold tracking-tight tabular">{Math.round(score)}</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted">score</div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-lg font-semibold">{band.label}</div>
        {caption && <div className="mt-0.5 max-w-xs text-sm text-ink-2">{caption}</div>}
      </div>
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  note,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-2/70 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {value ?? "—"}
        {unit && value != null && <span className="ml-1 text-sm font-normal text-ink-2">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-xs text-ink-2">{note}</div>}
    </div>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
        active ? "gradient-bg text-white shadow-md" : "bg-surface-2 text-ink hover:brightness-95 dark:hover:brightness-125"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rise mt-4 flex items-start gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--critical)" }} />
      {message}
    </p>
  );
}
