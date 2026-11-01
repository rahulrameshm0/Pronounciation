"""Speaking-voice analysis with Praat (parselmouth): pitch, intensity, formants, voice quality."""
import numpy as np
import parselmouth
from parselmouth.praat import call

from .notes import finite_or_none, hz_to_midi, midi_to_name

PITCH_FLOOR = 75.0
PITCH_CEILING = 600.0


def _label_jitter(pct):
    if pct is None:
        return "not enough voicing"
    return "steady" if pct < 1.04 else "slightly unsteady" if pct < 2.0 else "unsteady"


def _label_shimmer(pct):
    if pct is None:
        return "not enough voicing"
    return "steady" if pct < 3.81 else "slightly rough" if pct < 7.0 else "rough"


def _label_hnr(db):
    if db is None:
        return "not enough voicing"
    return "clear" if db >= 20 else "slightly breathy" if db >= 12 else "breathy / hoarse"


def _label_variation(semitones):
    if semitones is None:
        return "not enough voicing"
    return "monotone" if semitones < 2 else "moderate" if semitones < 4 else "expressive"


def analyze_voice(samples: np.ndarray, sr: int) -> dict:
    snd = parselmouth.Sound(samples.astype(np.float64), sampling_frequency=sr)

    pitch = snd.to_pitch(time_step=0.01, pitch_floor=PITCH_FLOOR, pitch_ceiling=PITCH_CEILING)
    f0 = pitch.selected_array["frequency"]
    times = pitch.xs()
    voiced = f0 > 0

    intensity = snd.to_intensity(minimum_pitch=PITCH_FLOOR, time_step=0.01)
    formant = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5500)

    pitch_contour = [
        {"t": round(float(t), 3), "hz": round(float(f), 2) if f > 0 else None}
        for t, f in zip(times, f0)
    ]
    intensity_contour = [
        {"t": round(float(t), 3), "db": finite_or_none(v, 2)}
        for t, v in zip(intensity.xs(), intensity.values[0])
    ]

    formant_points = []
    for t in times[voiced][::3]:
        f1, f2, f3 = (formant.get_value_at_time(n, t) for n in (1, 2, 3))
        if all(np.isfinite(v) for v in (f1, f2)):
            formant_points.append({"t": round(float(t), 3), "f1": round(f1), "f2": round(f2),
                                   "f3": finite_or_none(f3, 0)})

    stats = {"voiced_ratio": round(float(voiced.mean()), 3) if f0.size else 0.0}
    jitter = shimmer = hnr = variation = None
    if voiced.sum() >= 10:
        vf = f0[voiced]
        semis = np.array([hz_to_midi(f) for f in vf])
        variation = float(np.std(semis))
        stats.update({
            "f0_mean": round(float(vf.mean()), 1),
            "f0_min": round(float(vf.min()), 1),
            "f0_max": round(float(vf.max()), 1),
            "f0_mean_note": midi_to_name(hz_to_midi(float(np.median(vf)))),
            "range_semitones": round(float(semis.max() - semis.min()), 1),
        })
        pp = call(snd, "To PointProcess (periodic, cc)", PITCH_FLOOR, PITCH_CEILING)
        jitter = finite_or_none(call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100)
        shimmer = finite_or_none(
            call([snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100)
        harm = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=PITCH_FLOOR)
        hnr = finite_or_none(call(harm, "Get mean", 0, 0), 2)

    db_vals = intensity.values[0]
    stats["intensity_mean"] = finite_or_none(float(np.mean(db_vals)), 1) if db_vals.size else None

    return {
        "duration": round(snd.duration, 3),
        "pitch": pitch_contour,
        "intensity": intensity_contour,
        "formants": formant_points,
        "stats": stats,
        "quality": {
            "jitter_pct": {"value": jitter, "label": _label_jitter(jitter)},
            "shimmer_pct": {"value": shimmer, "label": _label_shimmer(shimmer)},
            "hnr_db": {"value": hnr, "label": _label_hnr(hnr)},
            "pitch_variation_st": {"value": finite_or_none(variation, 2),
                                   "label": _label_variation(variation)},
        },
    }
