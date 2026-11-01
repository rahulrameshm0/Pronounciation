export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export function midiToName(midi: number) {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Nearest note and how many cents the pitch is off it. */
export function describePitch(hz: number) {
  const midi = hzToMidi(hz);
  const nearest = Math.round(midi);
  return { midi, name: midiToName(nearest), cents: Math.round((midi - nearest) * 100) };
}
