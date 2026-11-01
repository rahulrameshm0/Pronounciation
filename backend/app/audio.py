"""Audio decoding helpers: any browser recording (webm/ogg/wav/mp4) -> mono float32."""
import subprocess

import numpy as np

SAMPLE_RATE = 16000


class AudioDecodeError(ValueError):
    pass


def decode_audio(data: bytes, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Decode arbitrary audio bytes with ffmpeg into mono float32 samples at `sr`."""
    if not data:
        raise AudioDecodeError("Empty audio upload")
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", "pipe:0",
         "-f", "f32le", "-ac", "1", "-ar", str(sr), "pipe:1"],
        input=data, capture_output=True, check=False,
    )
    if proc.returncode != 0:
        raise AudioDecodeError(proc.stderr.decode(errors="ignore").strip() or "ffmpeg failed")
    samples = np.frombuffer(proc.stdout, dtype=np.float32)
    if samples.size < sr * 0.3:
        raise AudioDecodeError("Recording is too short (need at least 0.3 s)")
    return samples
