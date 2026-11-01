import { Activity, AudioLines, Gauge, MoveVertical, Sparkles, TrendingUp, Volume2, Waves, Wind } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, ErrorNote, MicButton, StatTile } from "../../components/ui";
import { LivePitch, VolumeMeter } from "../../components/LivePitch";
import { analyzeVoice, type Labeled, type VoiceAnalysis } from "../../lib/api";
import { axisProps, gridProps, tooltipProps } from "../../lib/chart";
import { describePitch } from "../../lib/notes";
import { trackPitch, type PitchFrame } from "../../lib/pitch";
import { MicRecorder } from "../../lib/recorder";

const PROMPTS = [
  { label: "Read a sentence", text: "The quick brown fox jumps over the lazy dog." },
  { label: "Hold a vowel", text: "Say “aaaa” steadily for 5 seconds — best for voice-quality stats." },
  { label: "Pitch glide", text: "Glide from your lowest to your highest comfortable note." },
  { label: "Free talk", text: "Talk naturally about your day for 10–20 seconds." },
];

export function VocalPage() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceAnalysis | null>(null);
  const [prompt, setPrompt] = useState(0);
  const frames = useRef<PitchFrame[]>([]);
  const recorder = useRef(new MicRecorder());
  const stopTracking = useRef<() => void>(() => {});

  useEffect(() => () => {
    stopTracking.current();
    recorder.current.release();
  }, []);

  async function toggle() {
    if (recording) {
      stopTracking.current();
      setRecording(false);
      const blob = await recorder.current.stop();
      setBusy(true);
      try {
        setResult(await analyzeVoice(blob));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    setError(null);
    try {
      frames.current = [];
      await recorder.current.start();
      stopTracking.current = trackPitch(recorder.current.stream!, (f) => frames.current.push(f), { maxHz: 1000 });
      setRecording(true);
    } catch (e) {
      setError(`Microphone unavailable: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rise grid grid-cols-1 gap-6 rounded-[2rem] border border-line bg-surface p-6 shadow-card backdrop-blur-xl sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">
            Analyse your <span className="gradient-text">voice</span>
          </h1>
          <p className="mt-1 text-sm text-ink-2">See your pitch live, then get a full breakdown of tone and stability.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {PROMPTS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPrompt(i)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  prompt === i ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 min-h-10 text-sm text-ink">{PROMPTS[prompt].text}</p>
          <div className="mt-6 flex items-center gap-4 lg:mt-auto">
            <MicButton
              recording={recording}
              busy={busy}
              onClick={toggle}
              label={recording ? "Stop and analyse" : "Start recording"}
            />
            <div className="text-sm">
              <div className="font-semibold">{recording ? "Recording…" : busy ? "Analysing…" : "Ready"}</div>
              <div className="text-muted">{recording ? "Tap to stop & analyse" : "Tap the mic to start"}</div>
            </div>
          </div>
        </div>
        <div>
          <LivePitch frames={frames} active={recording} height={240} />
          <VolumeMeter frames={frames} />
          <ErrorNote message={error} />
        </div>
      </section>

      {result && <VoiceReport data={result} />}
    </div>
  );
}

function qualityNote(q: Labeled, good: string) {
  return q.value == null ? q.label : `${q.label === good ? "✓" : "!"} ${q.label}`;
}

function VoiceReport({ data }: { data: VoiceAnalysis }) {
  const { stats, quality } = data;
  if (stats.f0_mean == null) {
    return (
      <Card title="Results" icon={Sparkles}>
        <p className="text-sm text-ink-2">
          Not enough voiced sound was detected. Record a few seconds of speech or a held vowel.
        </p>
      </Card>
    );
  }
  const vowels = data.formants.filter((f) => f.f1 < 1200 && f.f2 < 3200);

  return (
    <>
      <Card title="Voice summary" subtitle={`${data.duration.toFixed(1)} s recording`} icon={Sparkles}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={AudioLines} label="Average pitch" value={stats.f0_mean} unit="Hz" note={`≈ ${stats.f0_mean_note}`} />
          <StatTile
            icon={MoveVertical}
            label="Pitch range"
            value={stats.range_semitones}
            unit="semitones"
            note={`${stats.f0_min}–${stats.f0_max} Hz`}
          />
          <StatTile
            icon={TrendingUp}
            label="Intonation"
            value={quality.pitch_variation_st.value}
            unit="st spread"
            note={quality.pitch_variation_st.label}
          />
          <StatTile icon={Activity} label="Voiced" value={Math.round(stats.voiced_ratio * 100)} unit="%" note="of recording" />
          <StatTile
            icon={Waves}
            label="Jitter · pitch steadiness"
            value={quality.jitter_pct.value}
            unit="%"
            note={qualityNote(quality.jitter_pct, "steady")}
          />
          <StatTile
            icon={Gauge}
            label="Shimmer · loudness steadiness"
            value={quality.shimmer_pct.value}
            unit="%"
            note={qualityNote(quality.shimmer_pct, "steady")}
          />
          <StatTile
            icon={Wind}
            label="HNR · clarity"
            value={quality.hnr_db.value}
            unit="dB"
            note={qualityNote(quality.hnr_db, "clear")}
          />
          <StatTile icon={Volume2} label="Average loudness" value={stats.intensity_mean} unit="dB" note="relative level" />
        </div>
        <p className="mt-4 text-xs text-muted">
          Typical healthy voice: jitter under 1%, shimmer under 3.8%, HNR above 20 dB. Held vowels give the most reliable
          values.
        </p>
      </Card>

      <Card title="Pitch over time" subtitle="Hz" icon={AudioLines}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.pitch} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="t" type="number" domain={[0, data.duration]} unit="s" {...axisProps} tickFormatter={(t) => t.toFixed(1)} />
            <YAxis {...axisProps} width={48} domain={["dataMin - 20", "dataMax + 20"]} tickFormatter={(v) => String(Math.round(v))} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(t) => `${Number(t).toFixed(2)} s`}
              formatter={(v: number) => {
                const p = describePitch(v);
                return [`${v.toFixed(0)} Hz · ${p.name} ${p.cents >= 0 ? "+" : ""}${p.cents}¢`, "Pitch"];
              }}
            />
            <Line dataKey="hz" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Loudness over time" subtitle="dB" icon={Volume2}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.intensity} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="loud" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="t" type="number" domain={[0, data.duration]} unit="s" {...axisProps} tickFormatter={(t) => t.toFixed(1)} />
              <YAxis {...axisProps} width={40} domain={["dataMin", "dataMax"]} tickFormatter={(v) => String(Math.round(v))} />
              <Tooltip
                {...tooltipProps}
                labelFormatter={(t) => `${Number(t).toFixed(2)} s`}
                formatter={(v: number) => [`${v.toFixed(1)} dB`, "Loudness"]}
              />
              <Area dataKey="db" stroke="var(--series-1)" strokeWidth={2} fill="url(#loud)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Vowel space" subtitle="Formants F1 × F2" icon={Waves}>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} vertical />
              <XAxis dataKey="f2" type="number" name="F2" unit=" Hz" reversed domain={[500, 3000]} {...axisProps} />
              <YAxis dataKey="f1" type="number" name="F1" unit=" Hz" reversed domain={[200, 1100]} width={64} {...axisProps} />
              <Tooltip {...tooltipProps} formatter={(v: number, name: string) => [`${v} Hz`, name]} />
              <Scatter data={vowels} fill="var(--series-1)" fillOpacity={0.5} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted">
            Top-left ≈ “ee”, top-right ≈ “oo”, bottom ≈ “ah”. A wider spread means clearer, more distinct vowels.
          </p>
        </Card>
      </div>
    </>
  );
}
