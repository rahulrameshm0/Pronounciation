export type Labeled = { value: number | null; label: string };

export type VoiceAnalysis = {
  duration: number;
  pitch: { t: number; hz: number | null }[];
  intensity: { t: number; db: number | null }[];
  formants: { t: number; f1: number; f2: number; f3: number | null }[];
  stats: {
    voiced_ratio: number;
    f0_mean?: number;
    f0_min?: number;
    f0_max?: number;
    f0_mean_note?: string;
    range_semitones?: number;
    intensity_mean?: number | null;
  };
  quality: { jitter_pct: Labeled; shimmer_pct: Labeled; hnr_db: Labeled; pitch_variation_st: Labeled };
};

export type TargetNote = { midi: number; start: number; duration: number };

export type NoteResult = TargetNote & {
  index: number;
  name: string;
  heard: boolean;
  score: number;
  cents_off?: number;
  in_tune_pct?: number;
  stability_cents?: number;
  onset_delay?: number | null;
  sung_name?: string;
};

export type SingingAnalysis = {
  overall_score: number;
  octave_shift: number;
  notes: NoteResult[];
  vibrato: { rate_hz: number | null; extent_cents: number | null };
  contour: { t: number; midi: number }[];
  tips: string[];
};

export type Transcript = {
  transcript: string;
  confidence: number;
  words: { word: string; probability: number; start: number; end: number }[];
  language: string;
  language_supported: boolean;
};

export type Phonemes = { supported: boolean; ipa: string | null; words: { word: string; ipa: string }[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Cannot reach the analysis server — is the backend running on :8010?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const audioForm = (audio: Blob) => {
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  return form;
};

export const analyzeVoice = (audio: Blob) =>
  request<VoiceAnalysis>("/api/analyze/voice", { method: "POST", body: audioForm(audio) });

export function analyzeSinging(audio: Blob, notes: TargetNote[]) {
  const form = audioForm(audio);
  form.append("notes", JSON.stringify(notes));
  return request<SingingAnalysis>("/api/analyze/singing", { method: "POST", body: form });
}

export const getPhonemes = (text: string, lang: string) =>
  request<Phonemes>(`/api/phonemes?${new URLSearchParams({ text, lang })}`);

export function transcribe(audio: Blob, lang: string) {
  const form = audioForm(audio);
  form.append("lang", lang);
  return request<Transcript>("/api/transcribe", { method: "POST", body: form });
}
