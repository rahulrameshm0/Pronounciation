import { transcribe, type Transcript } from "../../lib/api";
import { trackPitch } from "../../lib/pitch";
import { MicRecorder } from "../../lib/recorder";

export type Utterance = { result: Promise<Transcript>; stop: () => void };

const SPEECH_RMS = 0.02;
const SILENCE_AFTER_SPEECH_MS = 1200;
const MAX_MS = 12000;
const GIVE_UP_MS = 7000;

/**
 * Records one utterance in any browser (MediaRecorder), auto-stopping after a pause,
 * then transcribes it on the server with Whisper. `onLevel` gets 0..1 mic loudness;
 * `onStop` fires when recording ends and upload begins.
 */
export function listenOnce(
  lang: string,
  { onLevel, onStop }: { onLevel?: (level: number) => void; onStop?: () => void } = {},
): Utterance {
  const mic = new MicRecorder();
  let stopTracking = () => {};
  let finish: () => void = () => {};
  const stopped = new Promise<void>((resolve) => (finish = resolve));

  const result = (async () => {
    const startedAt = await mic.start();
    let heardSpeech = false;
    let lastLoud = startedAt;
    stopTracking = trackPitch(mic.stream!, ({ t, rms }) => {
      onLevel?.(Math.min(1, rms * 12));
      if (rms > SPEECH_RMS) {
        heardSpeech = true;
        lastLoud = t;
      }
      const silentFor = t - lastLoud;
      if ((heardSpeech && silentFor > SILENCE_AFTER_SPEECH_MS) || t - startedAt > MAX_MS) finish();
      if (!heardSpeech && t - startedAt > GIVE_UP_MS) finish();
    });
    await stopped;
    stopTracking();
    onLevel?.(0);
    onStop?.();
    const blob = await mic.stop();
    if (!heardSpeech) throw new Error("No speech detected — try again and speak clearly.");
    return transcribe(blob, lang);
  })();

  result.catch(() => {
    stopTracking();
    mic.release();
  });
  return { result, stop: () => finish() };
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** Firefox/Safari load voices asynchronously; wait for them once. */
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    synth.addEventListener("voiceschanged", () => resolve(synth.getVoices()), { once: true });
    setTimeout(() => resolve(synth.getVoices()), 1500);
  });
  return voicesReady;
}

export const speechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

/** Speaks text with the best-matching installed voice for the locale. */
export async function speak(text: string, lang: string, rate = 0.85) {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const voices = await getVoices();
  const base = lang.split("-")[0].toLowerCase();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const voice =
    voices.find((v) => norm(v) === lang.toLowerCase()) ?? voices.find((v) => norm(v).startsWith(base));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  if (voice) u.voice = voice;
  synth.cancel();
  synth.speak(u);
  return Boolean(voice);
}
