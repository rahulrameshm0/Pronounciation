import { Headphones, ListMusic, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Button, Card, ErrorNote, Field, MicButton } from "../../components/ui";
import { LivePitch, type LiveTarget } from "../../components/LivePitch";
import { analyzeSinging, type SingingAnalysis, type TargetNote } from "../../lib/api";
import { midiToName } from "../../lib/notes";
import { trackPitch, type PitchFrame } from "../../lib/pitch";
import { MicRecorder } from "../../lib/recorder";
import { load, save } from "../../lib/storage";
import { EXERCISES, ROOTS, buildExercise, type ExerciseKind } from "./exercises";
import { RangeTest } from "./RangeTest";
import { SingingReport } from "./SingingReport";
import { playExercise, type Session } from "./session";

type Settings = { kind: ExerciseKind; root: number; bpm: number; custom: string; guide: boolean };
const DEFAULTS: Settings = { kind: "major", root: 60, bpm: 70, custom: "C4 E4 G4 C5:2", guide: true };

export function MusicPage() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load("voicecoach.music", {}) }));
  const [phase, setPhase] = useState<"idle" | "listening" | "singing" | "analysing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SingingAnalysis | null>(null);
  const frames = useRef<PitchFrame[]>([]);
  const targets = useRef<LiveTarget[]>([]);
  const mic = useRef(new MicRecorder());
  const session = useRef<Session | null>(null);
  const stopTracking = useRef<() => void>(() => {});
  const timer = useRef<number>();
  const sentNotes = useRef<TargetNote[]>([]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => {
      const next = { ...s, [k]: v };
      save("voicecoach.music", next);
      return next;
    });

  const notes = buildExercise(settings.kind, settings.root, settings.custom);
  const midis = notes?.map((n) => n.midi) ?? [settings.root];
  const midiRange: [number, number] = [Math.min(...midis) - 6, Math.max(...midis) + 6];

  function cleanup() {
    window.clearTimeout(timer.current);
    stopTracking.current();
    stopTracking.current = () => {};
    session.current?.dispose();
    session.current = null;
  }
  useEffect(() => () => {
    cleanup();
    mic.current.release();
  }, []);

  async function listen() {
    if (!notes) return;
    await Tone.start();
    cleanup();
    setPhase("listening");
    const s = playExercise(notes, settings.bpm, { guide: true, clicks: true });
    session.current = s;
    targets.current = s.notes.map((n) => ({ midi: n.midi, start: s.toPerf(n.ctxStart), end: s.toPerf(n.ctxEnd) }));
    frames.current = [];
    timer.current = window.setTimeout(() => {
      cleanup();
      setPhase("idle");
    }, (s.end - Tone.now()) * 1000 + 300);
  }

  async function sing() {
    if (!notes) return;
    setError(null);
    setResult(null);
    cleanup();
    try {
      await Tone.start();
      const startedAt = await mic.current.start();
      frames.current = [];
      stopTracking.current = trackPitch(mic.current.stream!, (f) => frames.current.push(f));
      const s = playExercise(notes, settings.bpm, { guide: settings.guide, clicks: true });
      session.current = s;
      targets.current = s.notes.map((n) => ({ midi: n.midi, start: s.toPerf(n.ctxStart), end: s.toPerf(n.ctxEnd) }));
      sentNotes.current = s.notes.map((n) => ({
        midi: n.midi,
        start: (s.toPerf(n.ctxStart) - startedAt) / 1000,
        duration: n.ctxEnd - n.ctxStart,
      }));
      setPhase("singing");
      timer.current = window.setTimeout(finish, (s.end - Tone.now()) * 1000 + 500);
    } catch (e) {
      cleanup();
      mic.current.release();
      setError(`Microphone unavailable: ${(e as Error).message}`);
    }
  }

  async function finish() {
    cleanup();
    const blob = await mic.current.stop();
    setPhase("analysing");
    try {
      setResult(await analyzeSinging(blob, sentNotes.current));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Exercise" subtitle="Choose what to sing" icon={ListMusic}>
            <div className="space-y-4">
              <Field label="Pattern">
                <select value={settings.kind} onChange={(e) => set("kind", e.target.value as ExerciseKind)} className="field">
                  {EXERCISES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
              {settings.kind === "custom" ? (
                <Field label="Notes (e.g. C4 D4 E4:2 — “:2” = 2 beats)">
                  <input value={settings.custom} onChange={(e) => set("custom", e.target.value)} className="field font-mono" />
                  {!notes && <span className="mt-1 block text-xs text-ink-2">Couldn't read those notes</span>}
                </Field>
              ) : (
                <Field label="Key / starting note">
                  <select value={settings.root} onChange={(e) => set("root", Number(e.target.value))} className="field">
                    {ROOTS.map((m) => (
                      <option key={m} value={m}>
                        {midiToName(m)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={`Tempo · ${settings.bpm} BPM`}>
                <input
                  type="range"
                  min={40}
                  max={140}
                  value={settings.bpm}
                  onChange={(e) => set("bpm", Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </Field>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-surface-2/70 px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Headphones size={16} className="text-accent" />
                  <span>
                    Guide tones while singing
                    <span className="block text-xs text-muted">Use headphones</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.guide}
                  onChange={(e) => set("guide", e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </label>
            </div>
          </Card>
          <RangeTest onUseRoot={(m) => setSettings((s) => ({ ...s, root: m, kind: s.kind === "custom" ? "major" : s.kind }))} />
        </div>

        <section className="rise order-first flex flex-col rounded-[2rem] lg:order-none border border-line bg-surface p-6 shadow-card backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sing <span className="gradient-text">along</span>
              </h1>
              <p className="mt-1 text-sm text-ink-2">
                {phase === "singing"
                  ? "Keep the glowing line on the grey bars."
                  : phase === "analysing"
                    ? "Analysing your pitch…"
                    : "4 clicks count you in, then sing each note as it reaches the line."}
              </p>
            </div>
            <Button icon={Play} onClick={listen} disabled={!notes || phase !== "idle"}>
              {phase === "listening" ? "Playing…" : "Listen first"}
            </Button>
          </div>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {notes?.map((n, i) => (
              <span key={i} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-ink-2">
                {midiToName(n.midi)}
              </span>
            ))}
          </div>
          <LivePitch
            frames={frames}
            targets={targets}
            active={phase === "singing"}
            midiRange={midiRange}
            windowMs={8000}
            height={300}
          />
          <div className="mt-6 flex items-center justify-center gap-4">
            <MicButton
              recording={phase === "singing"}
              busy={phase === "analysing"}
              onClick={phase === "singing" ? finish : sing}
              disabled={!notes || phase === "listening"}
              label={phase === "singing" ? "Stop singing" : "Start singing"}
            />
          </div>
          <ErrorNote message={error} />
        </section>
      </div>

      {result && <SingingReport data={result} />}
    </div>
  );
}
