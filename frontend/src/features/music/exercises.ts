import { NOTE_NAMES } from "../../lib/notes";

export type ExerciseKind = "major" | "minor" | "five" | "arpeggio" | "sustain" | "custom";

export const EXERCISES: { id: ExerciseKind; label: string }[] = [
  { id: "major", label: "Major scale (up & down)" },
  { id: "minor", label: "Natural minor scale" },
  { id: "five", label: "5-note warm-up (do-re-mi-fa-so)" },
  { id: "arpeggio", label: "Major arpeggio" },
  { id: "sustain", label: "Sustained note (4 beats)" },
  { id: "custom", label: "Custom notes" },
];

const PATTERNS: Record<Exclude<ExerciseKind, "custom">, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
  minor: [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0],
  five: [0, 2, 4, 5, 7, 5, 4, 2, 0],
  arpeggio: [0, 4, 7, 12, 7, 4, 0],
  sustain: [0],
};

export type ExerciseNote = { midi: number; beats: number };

/** Parses "C4 D#4 Eb4 G4:2" (optional :beats). Returns null on a bad token. */
export function parseNotes(input: string): ExerciseNote[] | null {
  const out: ExerciseNote[] = [];
  for (const tok of input.trim().split(/[\s,]+/).filter(Boolean)) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)(?::(\d+(?:\.\d+)?))?$/.exec(tok);
    if (!m) return null;
    let pc = NOTE_NAMES.indexOf(m[1].toUpperCase());
    if (m[2] === "#") pc += 1;
    if (m[2] === "b") pc -= 1;
    out.push({ midi: (Number(m[3]) + 1) * 12 + pc, beats: m[4] ? Number(m[4]) : 1 });
  }
  return out.length ? out : null;
}

export function buildExercise(kind: ExerciseKind, root: number, custom: string): ExerciseNote[] | null {
  if (kind === "custom") return parseNotes(custom);
  if (kind === "sustain") return [{ midi: root, beats: 4 }];
  return PATTERNS[kind].map((i) => ({ midi: root + i, beats: 1 }));
}

/** Root notes offered in the key picker: C2 … C5. */
export const ROOTS = Array.from({ length: 37 }, (_, i) => 36 + i);
