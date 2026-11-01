import { MoveVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNote, RecordButton } from "../../components/ui";
import { LivePitch } from "../../components/LivePitch";
import { hzToMidi, midiToName } from "../../lib/notes";
import { trackPitch, type PitchFrame } from "../../lib/pitch";
import { MicRecorder } from "../../lib/recorder";

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/** Finds the singer's comfortable range from a glide/siren and suggests a key. */
export function RangeTest({ onUseRoot }: { onUseRoot: (midi: number) => void }) {
  const [active, setActive] = useState(false);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frames = useRef<PitchFrame[]>([]);
  const mic = useRef(new MicRecorder());
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => {
    stop.current();
    mic.current.release();
  }, []);

  async function toggle() {
    if (active) {
      stop.current();
      mic.current.release();
      setActive(false);
      const midis = frames.current.filter((f) => f.hz && f.clarity > 0.92).map((f) => hzToMidi(f.hz!));
      if (midis.length < 30) {
        setError("Not enough singing detected — glide slowly from low to high.");
        return;
      }
      midis.sort((a, b) => a - b);
      setRange([Math.round(percentile(midis, 0.05)), Math.round(percentile(midis, 0.95))]);
      return;
    }
    setError(null);
    setRange(null);
    frames.current = [];
    try {
      await mic.current.start();
      stop.current = trackPitch(mic.current.stream!, (f) => frames.current.push(f));
      setActive(true);
    } catch (e) {
      setError(`Microphone unavailable: ${(e as Error).message}`);
    }
  }

  const span = range ? range[1] - range[0] : 0;
  const suggested = range ? (span >= 14 ? range[0] + Math.floor((span - 12) / 2) : range[0]) : null;

  return (
    <Card
      title="Range test"
      subtitle="Find your best key"
      icon={MoveVertical}
      actions={<RecordButton recording={active} onClick={toggle} idleLabel="Start" activeLabel="Done" />}
    >
      <p className="mb-3 text-sm text-ink-2">Slide from your lowest comfortable note up to your highest, like a siren.</p>
      {active && <LivePitch frames={frames} active height={160} />}
      {range && suggested != null && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-2/70 p-4">
          <div>
            <div className="text-xs text-muted">Your range</div>
            <div className="gradient-text text-2xl font-bold">
              {midiToName(range[0])} – {midiToName(range[1])}
            </div>
            <div className="text-xs text-ink-2">{span} semitones ({(span / 12).toFixed(1)} octaves)</div>
          </div>
          <Button variant="soft" onClick={() => onUseRoot(suggested)}>Use key {midiToName(suggested)}</Button>
        </div>
      )}
      <ErrorNote message={error} />
    </Card>
  );
}
