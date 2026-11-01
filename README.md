# VoiceCoach

Pronunciation, voice and singing practice in the browser.

- **Pronunciation**: pick any of ~110 languages and say a word or sentence. Recording stops by itself when you pause, then Whisper transcribes it on the server and each word is scored 0–100. IPA is shown, with "Listen" / "Slow" reference audio.
- **Vocal analysis**: a live pitch graph while you speak, then charts for pitch, loudness and vowel formants, plus jitter, shimmer and HNR voice-quality stats.
- **Music**: sing scales, arpeggios or your own notes over a target-note piano roll. You get cents-off per note, time in tune, vibrato, and tips. Includes a vocal range test.

## Run

Needs Python 3.12, Node 20+, ffmpeg and espeak-ng (`brew install ffmpeg espeak-ng`).

```bash
# backend (port 8010)
cd backend
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8010 --reload

# frontend (port 5180)
cd frontend
npm install
npm run dev
```

Open http://localhost:5180 in any modern browser (Chrome, Edge, Firefox, Safari) and allow the microphone.
The first backend start downloads the Whisper `small` model (~460 MB). Set `WHISPER_MODEL=base` for a smaller and faster model, or `medium` for a more accurate one.
You can link straight to a tab: `#pronunciation`, `#voice` or `#singing`.
For the Music tab, use headphones if "guide tones" is on, so the reference notes don't leak into the mic.

## Tests

```bash
cd backend && .venv/bin/pytest -q      # synthetic-tone tests for pitch, voice quality and singing scoring
cd frontend && npm run build           # typecheck + production build
```

## Limits

- Speech recognition runs locally with Whisper (offline after the model download) and covers 99 languages. A few listed locales Whisper doesn't know (e.g. Zulu, Irish) fall back to auto-detect, so they're less reliable. Scores are per word, not per phoneme.
- Jitter, shimmer and HNR are most reliable on a held vowel ("aaaa").
