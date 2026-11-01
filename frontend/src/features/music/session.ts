import * as Tone from "tone";
import { midiToHz } from "../../lib/notes";
import type { ExerciseNote } from "./exercises";

export type ScheduledNote = { midi: number; ctxStart: number; ctxEnd: number };

export type Session = {
  notes: ScheduledNote[];
  /** Converts an AudioContext time (s) to performance.now() (ms). */
  toPerf: (ctxTime: number) => number;
  end: number;
  dispose: () => void;
};

const COUNT_IN = 4;

/** Schedules a count-in plus (optionally audible) guide tones. Call after Tone.start() in a user gesture. */
export function playExercise(notes: ExerciseNote[], bpm: number, { guide, clicks }: { guide: boolean; clicks: boolean }): Session {
  const beat = 60 / bpm;
  const synth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.2 },
  }).toDestination();
  synth.volume.value = -10;
  // Unpitched noise ticks so the metronome doesn't confuse the pitch tracker.
  const tick = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).toDestination();
  tick.volume.value = -14;

  const ctxNow = Tone.now();
  const perfNow = performance.now();
  const base = ctxNow + 0.3;

  if (clicks) for (let i = 0; i < COUNT_IN; i++) tick.triggerAttackRelease(0.03, base + i * beat);

  let t = base + COUNT_IN * beat;
  const scheduled = notes.map((n) => {
    const dur = n.beats * beat;
    if (guide) synth.triggerAttackRelease(midiToHz(n.midi), dur * 0.92, t);
    const s = { midi: n.midi, ctxStart: t, ctxEnd: t + dur };
    t += dur;
    return s;
  });

  return {
    notes: scheduled,
    toPerf: (ctxTime) => perfNow + (ctxTime - ctxNow) * 1000,
    end: t,
    dispose: () => {
      synth.dispose();
      tick.dispose();
    },
  };
}
