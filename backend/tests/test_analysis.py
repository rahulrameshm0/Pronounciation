import io
import json
import subprocess

import numpy as np
from fastapi.testclient import TestClient

from app.analysis import analyze_voice
from app.audio import decode_audio
from app.main import app
from app.notes import midi_to_hz, midi_to_name
from app.singing import analyze_singing

SR = 16000


def tone(hz, seconds, sr=SR):
    t = np.arange(int(seconds * sr)) / sr
    # add harmonics so it resembles a voice rather than a pure sine
    return (0.5 * np.sin(2 * np.pi * hz * t) + 0.2 * np.sin(4 * np.pi * hz * t)).astype(np.float32)


def to_wav(samples):
    proc = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1",
                           "-i", "pipe:0", "-f", "wav", "pipe:1"],
                          input=samples.tobytes(), capture_output=True, check=True)
    return proc.stdout


def test_note_names():
    assert midi_to_name(69) == "A4"
    assert midi_to_name(60) == "C4"
    assert abs(midi_to_hz(69) - 440) < 1e-9


def test_decode_roundtrip():
    out = decode_audio(to_wav(tone(220, 1.0)))
    assert abs(out.size - SR) < 200


def test_voice_on_steady_tone():
    result = analyze_voice(tone(220, 2.0), SR)
    assert abs(result["stats"]["f0_mean"] - 220) < 2
    assert result["stats"]["f0_mean_note"] == "A3"
    assert result["quality"]["jitter_pct"]["value"] < 0.5
    assert result["quality"]["pitch_variation_st"]["label"] == "monotone"


def test_singing_scores_in_tune_and_flat():
    # C4, E4 in tune; G4 sung 40 cents flat
    notes = [{"midi": 60, "start": 0.0, "duration": 1.0},
             {"midi": 64, "start": 1.0, "duration": 1.0},
             {"midi": 67, "start": 2.0, "duration": 1.0}]
    audio = np.concatenate([tone(midi_to_hz(60), 1), tone(midi_to_hz(64), 1),
                            tone(midi_to_hz(67 - 0.4), 1)])
    res = analyze_singing(audio, SR, notes)
    c4, e4, g4 = res["notes"]
    assert abs(c4["cents_off"]) < 5 and abs(e4["cents_off"]) < 5
    assert -50 < g4["cents_off"] < -30
    assert c4["score"] > g4["score"]
    assert res["octave_shift"] == 0


def test_singing_octave_shift():
    notes = [{"midi": 72, "start": 0.0, "duration": 1.5}]
    res = analyze_singing(tone(midi_to_hz(60), 1.5), SR, notes)
    assert res["octave_shift"] == -1
    assert abs(res["notes"][0]["cents_off"]) < 5


def test_api_endpoints():
    client = TestClient(app)
    assert client.get("/api/health").json() == {"ok": True}
    wav = to_wav(tone(330, 1.5))
    r = client.post("/api/analyze/voice", files={"audio": ("a.wav", io.BytesIO(wav), "audio/wav")})
    assert r.status_code == 200 and r.json()["stats"]["f0_mean_note"] == "E4"
    r = client.post("/api/analyze/singing",
                    files={"audio": ("a.wav", io.BytesIO(wav), "audio/wav")},
                    data={"notes": json.dumps([{"midi": 64, "start": 0, "duration": 1.5}])})
    assert r.status_code == 200 and r.json()["overall_score"] > 90
    assert client.post("/api/analyze/voice",
                       files={"audio": ("a.wav", io.BytesIO(b""), "audio/wav")}).status_code == 400


def test_whisper_language_mapping():
    from app.transcribe import whisper_language

    assert whisper_language("ml-IN") == "ml"
    assert whisper_language("yue-Hant-HK") == "yue"
    assert whisper_language("fil-PH") == "tl"
    assert whisper_language("zu-ZA") is None
