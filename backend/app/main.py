import json
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis import analyze_voice
from .audio import SAMPLE_RATE, AudioDecodeError, decode_audio
from .phonemes import PhonemizerUnavailable, to_ipa
from .singing import analyze_singing
from .transcribe import get_model, transcribe

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load (and on first run, download) Whisper in the background so startup stays instant.
    threading.Thread(target=get_model, daemon=True).start()
    yield


app = FastAPI(title="VoiceCoach API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5180", "http://127.0.0.1:5180"],
                   allow_methods=["*"], allow_headers=["*"])


async def _load(audio: UploadFile):
    try:
        return decode_audio(await audio.read(), SAMPLE_RATE)
    except AudioDecodeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/phonemes")
def phonemes(text: str = Query(..., min_length=1, max_length=500), lang: str = "en-US"):
    try:
        return to_ipa(text.strip(), lang)
    except PhonemizerUnavailable as exc:
        raise HTTPException(503, f"espeak-ng not available: {exc}") from exc


@app.post("/api/transcribe")
async def speech_to_text(audio: UploadFile = File(...), lang: str = Form("en-US")):
    return transcribe(await _load(audio), lang)


@app.post("/api/analyze/voice")
async def voice(audio: UploadFile = File(...)):
    return analyze_voice(await _load(audio), SAMPLE_RATE)


@app.post("/api/analyze/singing")
async def singing(audio: UploadFile = File(...), notes: str = Form(...)):
    try:
        parsed = json.loads(notes)
        targets = [{"midi": int(n["midi"]), "start": float(n["start"]),
                    "duration": float(n["duration"])} for n in parsed]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(400, "notes must be a JSON list of {midi, start, duration}") from exc
    if not targets:
        raise HTTPException(400, "notes must not be empty")
    return analyze_singing(await _load(audio), SAMPLE_RATE, targets)
