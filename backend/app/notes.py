"""Pitch <-> note conversions shared by the analysis modules."""
import math

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def hz_to_midi(hz: float) -> float:
    return 69 + 12 * math.log2(hz / 440.0)


def midi_to_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def midi_to_name(midi: float) -> str:
    m = int(round(midi))
    return f"{NOTE_NAMES[m % 12]}{m // 12 - 1}"


def finite_or_none(value: float, digits: int = 3):
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)
