import { PitchDetector } from "pitchy";

export type PitchFrame = { t: number; hz: number | null; clarity: number; rms: number };

type Options = { minHz?: number; maxHz?: number; minClarity?: number; minRms?: number };

/** Runs YIN-style pitch detection on a live stream every animation frame. Returns a stop function. */
export function trackPitch(
  stream: MediaStream,
  onFrame: (frame: PitchFrame) => void,
  { minHz = 60, maxHz = 1200, minClarity = 0.88, minRms = 0.01 }: Options = {},
): () => void {
  const ctx = new AudioContext();
  void ctx.resume(); // Safari starts contexts suspended outside a direct gesture
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;

  const loop = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
    const valid = clarity >= minClarity && rms >= minRms && hz >= minHz && hz <= maxHz;
    onFrame({ t: performance.now(), hz: valid ? hz : null, clarity, rms });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    void ctx.close();
  };
}
