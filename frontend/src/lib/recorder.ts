/** Microphone capture: one MediaStream feeding both a MediaRecorder and live analysers. */
export class MicRecorder {
  stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  /** Opens the mic (raw, no voice processing) and starts recording. Resolves with performance.now() at start. */
  async start(): Promise<number> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    return new Promise((resolve) => {
      this.recorder!.onstart = () => resolve(performance.now());
      this.recorder!.start();
    });
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === "inactive") return resolve(new Blob());
      rec.onstop = () => {
        resolve(new Blob(this.chunks, { type: rec.mimeType }));
        this.release();
      };
      rec.stop();
    });
  }

  release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}
