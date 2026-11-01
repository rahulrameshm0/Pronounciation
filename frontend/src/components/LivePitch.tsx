import { useEffect, useRef } from "react";
import { describePitch, hzToMidi, midiToName } from "../lib/notes";
import type { PitchFrame } from "../lib/pitch";

export type LiveTarget = { midi: number; start: number; end: number }; // start/end: performance.now() ms

type Props = {
  frames: React.MutableRefObject<PitchFrame[]>;
  active: boolean;
  windowMs?: number;
  /** Optional target notes drawn as bars (music mode). */
  targets?: React.MutableRefObject<LiveTarget[]>;
  midiRange?: [number, number];
  height?: number;
};

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Scrolling canvas graph of live pitch (in notes) with a tuner readout and optional target-note bars. */
export function LivePitch({ frames, active, windowMs = 6000, targets, midiRange = [40, 84], height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const detailRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const [lo, hi] = midiRange;
      const left = 40;
      const now = performance.now();
      const ahead = targets ? windowMs * 0.35 : 0; // music mode shows upcoming notes
      const t0 = now - (windowMs - ahead);
      const x = (t: number) => left + ((t - t0) / windowMs) * (w - left);
      const y = (m: number) => h - 8 - ((m - lo) / (hi - lo)) * (h - 16);

      g.font = "500 11px Inter, system-ui";
      g.textBaseline = "middle";
      for (let m = Math.ceil(lo); m <= hi; m++) {
        if (m % 12 !== 0 && m % 12 !== 7) continue;
        g.strokeStyle = cssVar("--grid");
        g.lineWidth = 1;
        g.setLineDash(m % 12 === 0 ? [] : [3, 4]);
        g.beginPath();
        g.moveTo(left, y(m));
        g.lineTo(w, y(m));
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = cssVar("--muted");
        g.fillText(midiToName(m), 8, y(m));
      }

      if (targets) {
        g.fillStyle = cssVar("--neutral");
        for (const tgt of targets.current) {
          if (tgt.end < t0 || tgt.start > t0 + windowMs) continue;
          const bh = Math.max(8, (h - 16) / (hi - lo));
          g.beginPath();
          g.roundRect(x(tgt.start), y(tgt.midi) - bh / 2, Math.max(4, x(tgt.end) - x(tgt.start) - 3), bh, bh / 2);
          g.fill();
        }
        g.strokeStyle = cssVar("--accent");
        g.globalAlpha = 0.5;
        g.beginPath();
        g.moveTo(x(now), 0);
        g.lineTo(x(now), h);
        g.stroke();
        g.globalAlpha = 1;
      }

      const grad = g.createLinearGradient(left, 0, w, 0);
      grad.addColorStop(0, cssVar("--accent"));
      grad.addColorStop(1, cssVar("--accent-2"));
      g.strokeStyle = grad;
      g.lineWidth = 3;
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      let pen = false;
      let prev: PitchFrame | null = null;
      let tip: [number, number] | null = null;
      for (const f of frames.current) {
        if (f.t < t0) continue;
        if (f.hz == null || (prev && f.t - prev.t > 120)) pen = false;
        if (f.hz != null) {
          const px = x(f.t);
          const py = y(hzToMidi(f.hz));
          if (pen) g.lineTo(px, py);
          else g.moveTo(px, py);
          pen = true;
          tip = [px, py];
        }
        prev = f;
      }
      g.stroke();

      const last = frames.current.at(-1);
      if (tip && last?.hz && active) {
        g.fillStyle = cssVar("--accent-2");
        g.beginPath();
        g.arc(tip[0], tip[1], 5, 0, Math.PI * 2);
        g.fill();
      }

      if (noteRef.current && detailRef.current && needleRef.current) {
        if (last?.hz && active) {
          const p = describePitch(last.hz);
          noteRef.current.textContent = p.name;
          detailRef.current.textContent = `${p.cents > 0 ? "+" : ""}${p.cents}¢ · ${Math.round(last.hz)} Hz`;
          needleRef.current.style.left = `${50 + p.cents}%`;
          needleRef.current.style.opacity = "1";
        } else {
          noteRef.current.textContent = "—";
          detailRef.current.textContent = active ? "Listening…" : "Mic off";
          needleRef.current.style.opacity = "0";
        }
      }
      if (frames.current.length > 4000) frames.current.splice(0, frames.current.length - 2000);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frames, targets, windowMs, midiRange, active]);

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-2/70">
      <div className="flex items-center gap-4 px-4 pt-3">
        <span ref={noteRef} className="min-w-14 text-3xl font-bold tracking-tight tabular" aria-live="polite" />
        <div className="flex-1">
          <span ref={detailRef} className="block text-xs font-medium text-muted tabular" />
          <div className="relative mt-1.5 h-1.5 rounded-full bg-[var(--grid)]">
            <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-[var(--axis)]" />
            <span
              ref={needleRef}
              className="gradient-bg absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow transition-[left] duration-100"
            />
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
    </div>
  );
}

export function VolumeMeter({ frames }: { frames: React.MutableRefObject<PitchFrame[]> }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const rms = frames.current.at(-1)?.rms ?? 0;
      const pct = Math.min(100, Math.max(0, ((20 * Math.log10(rms + 1e-6) + 60) / 60) * 100));
      if (barRef.current) barRef.current.style.width = `${pct}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames]);
  return (
    <div className="mt-3 flex items-center gap-3 text-xs font-medium text-muted">
      Level
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div ref={barRef} className="gradient-bg h-full rounded-full transition-[width] duration-75" />
      </div>
    </div>
  );
}
