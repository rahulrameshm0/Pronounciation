"""Singing analysis: compare a sung recording against a sequence of target notes."""
import numpy as np
import parselmouth

from .notes import finite_or_none, hz_to_midi, midi_to_name

IN_TUNE_CENTS = 50
ONSET_SKIP = 0.15  # ignore the first 15% of each note while the voice settles


def _vibrato(cents: np.ndarray, step: float):
    """Dominant 3-9 Hz modulation of a detrended cents track -> (rate_hz, extent_cents)."""
    if cents.size < int(0.6 / step):
        return None, None
    x = cents - np.polyval(np.polyfit(np.arange(cents.size), cents, 1), np.arange(cents.size))
    spectrum = np.abs(np.fft.rfft(x * np.hanning(x.size)))
    freqs = np.fft.rfftfreq(x.size, d=step)
    band = (freqs >= 3) & (freqs <= 9)
    if not band.any():
        return None, None
    peak = int(np.argmax(np.where(band, spectrum, 0)))
    if spectrum[peak] < 2 * np.median(spectrum[1:]):  # no clear periodic wobble
        return None, None
    return round(float(freqs[peak]), 2), round(float(np.std(x) * np.sqrt(2)), 1)


def analyze_singing(samples: np.ndarray, sr: int, notes: list[dict]) -> dict:
    """`notes`: [{"midi": int, "start": sec, "duration": sec}] relative to recording start."""
    snd = parselmouth.Sound(samples.astype(np.float64), sampling_frequency=sr)
    step = 0.01
    pitch = snd.to_pitch(time_step=step, pitch_floor=60, pitch_ceiling=1200)
    f0 = pitch.selected_array["frequency"]
    times = pitch.xs()
    midi_track = np.where(f0 > 0, 69 + 12 * np.log2(np.maximum(f0, 1e-9) / 440.0), np.nan)

    # Allow singing in a different octave: shift by the octave the singer is actually in.
    raw_offsets = []
    for n in notes:
        mask = (times >= n["start"]) & (times < n["start"] + n["duration"])
        raw_offsets.extend((midi_track[mask] - n["midi"])[~np.isnan(midi_track[mask])])
    octave_shift = int(round(np.median(raw_offsets) / 12)) if raw_offsets else 0

    results = []
    best_vibrato = (None, None, 0)
    for i, n in enumerate(notes):
        start, dur, target = n["start"], n["duration"], n["midi"] + 12 * octave_shift
        window = (times >= start) & (times < start + dur)
        steady = (times >= start + dur * ONSET_SKIP) & (times < start + dur)
        cents_all = (midi_track[window] - target) * 100
        cents = (midi_track[steady] - target) * 100
        cents = cents[~np.isnan(cents)]
        entry = {"index": i, "midi": n["midi"], "name": midi_to_name(n["midi"]),
                 "start": start, "duration": dur}
        if cents.size < 3:
            entry.update({"heard": False, "score": 0})
            results.append(entry)
            continue
        median = float(np.median(cents))
        in_tune = float(np.mean(np.abs(cents) <= IN_TUNE_CENTS) * 100)
        hits = np.where(np.abs(np.nan_to_num(cents_all, nan=1e9)) <= IN_TUNE_CENTS)[0]
        score = 0.5 * max(0.0, 100 - abs(median) * 1.2) + 0.5 * in_tune
        entry.update({
            "heard": True,
            "cents_off": round(median, 1),
            "in_tune_pct": round(in_tune, 1),
            "stability_cents": round(float(np.std(cents)), 1),
            "onset_delay": finite_or_none(hits[0] * step, 2) if hits.size else None,
            "sung_name": midi_to_name(target + median / 100 - 12 * octave_shift),
            "score": round(score, 1),
        })
        if dur > best_vibrato[2]:
            rate, extent = _vibrato(cents, step)
            if rate is not None:
                best_vibrato = (rate, extent, dur)
        results.append(entry)

    heard = [r for r in results if r["heard"]]
    overall = round(float(np.mean([r["score"] for r in results])), 1) if results else 0.0
    return {
        "overall_score": overall,
        "octave_shift": octave_shift,
        "notes": results,
        "vibrato": {"rate_hz": best_vibrato[0], "extent_cents": best_vibrato[1]},
        "contour": [{"t": round(float(t), 3), "midi": round(float(m) - 12 * octave_shift, 2)}
                    for t, m in zip(times, midi_track) if not np.isnan(m)],
        "tips": _tips(heard, len(results)),
    }


def _tips(heard: list[dict], total: int) -> list[str]:
    tips = []
    if total and len(heard) < total:
        tips.append(f"{total - len(heard)} note(s) were not heard — sing louder or hold each note longer.")
    if len(heard) < 2:
        return tips
    offs = np.array([r["cents_off"] for r in heard])
    if offs.mean() < -20:
        tips.append("You tend to sing flat overall — lift the pitch slightly and support with breath.")
    elif offs.mean() > 20:
        tips.append("You tend to sing sharp overall — relax and aim a little lower.")
    ordered = sorted(heard, key=lambda r: r["midi"])
    half = len(ordered) // 2
    if half:
        low, high = np.mean([r["cents_off"] for r in ordered[:half]]), np.mean(
            [r["cents_off"] for r in ordered[half:]])
        if high - low < -25:
            tips.append("You go flat on the higher notes — open the mouth more and keep airflow steady.")
        elif high - low > 25:
            tips.append("You overshoot the higher notes — approach them more gently.")
    shaky = [r["name"] for r in heard if r["stability_cents"] > 35]
    if shaky:
        tips.append(f"Pitch wobbles on {', '.join(shaky[:4])} — practise sustaining these notes.")
    late = [r["name"] for r in heard if (r.get("onset_delay") or 0) > 0.3]
    if late:
        tips.append(f"Slow to find {', '.join(late[:4])} — listen to the reference before singing.")
    if not tips:
        tips.append("Great pitch control! Try a faster tempo or a wider exercise.")
    return tips
