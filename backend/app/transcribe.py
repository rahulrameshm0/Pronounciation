"""Speech-to-text with Whisper (faster-whisper) so recognition works in every browser."""
import os
import threading
from functools import lru_cache

import numpy as np

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
ALIASES = {"jv": "jw", "fil": "tl", "nb": "no", "iw": "he"}

_lock = threading.Lock()  # CTranslate2 models are not safe to call concurrently from threads


@lru_cache(maxsize=1)
def get_model():
    from faster_whisper import WhisperModel

    return WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")


def whisper_language(bcp47: str) -> str | None:
    """'ml-IN' -> 'ml', 'yue-Hant-HK' -> 'yue'; None when Whisper doesn't know the language."""
    from faster_whisper.tokenizer import _LANGUAGE_CODES

    base = bcp47.split("-")[0].lower()
    base = ALIASES.get(base, base)
    return base if base in _LANGUAGE_CODES else None


def transcribe(samples: np.ndarray, bcp47: str) -> dict:
    lang = whisper_language(bcp47)
    with _lock:
        segments, info = get_model().transcribe(
            samples,
            language=lang,
            beam_size=5,
            temperature=0.0,
            word_timestamps=True,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300, "speech_pad_ms": 200},
        )
        # Drop segments Whisper itself thinks are silence/hallucination ("Thank you." on noise).
        segs = [s for s in segments if not (s.no_speech_prob > 0.6 and s.avg_logprob < -1.0)]

    words = [
        {"word": w.word.strip(), "probability": round(float(w.probability), 3),
         "start": round(float(w.start), 2), "end": round(float(w.end), 2)}
        for s in segs for w in (s.words or []) if w.word.strip()
    ]
    return {
        "transcript": "".join(s.text for s in segs).strip(),
        "confidence": round(float(np.mean([w["probability"] for w in words])), 3) if words else 0.0,
        "words": words,
        "language": info.language,
        "language_supported": lang is not None,
    }
