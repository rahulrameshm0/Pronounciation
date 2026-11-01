"""IPA transcription via phonemizer + espeak-ng (~100 languages)."""
import os
from functools import lru_cache

for _lib in ("/opt/homebrew/lib/libespeak-ng.dylib", "/usr/local/lib/libespeak-ng.dylib"):
    if os.path.exists(_lib):
        os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", _lib)
        break


class PhonemizerUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _supported() -> dict[str, str]:
    try:
        from phonemizer.backend import EspeakBackend
        return EspeakBackend.supported_languages()
    except Exception as exc:  # espeak-ng not installed
        raise PhonemizerUnavailable(str(exc)) from exc


def resolve_language(bcp47: str) -> str | None:
    """Map a BCP-47 tag (e.g. 'en-US', 'ml-IN', 'cmn-Hans-CN') to an espeak voice code."""
    langs = _supported()
    tag = bcp47.lower().replace("_", "-")
    aliases = {"zh": "cmn", "cmn-hans": "cmn", "yue-hant": "yue", "nb": "nb", "no": "nb",
               "fil": "tl", "iw": "he", "in": "id"}
    parts = tag.split("-")
    candidates = [tag, "-".join(parts[:2]), parts[0], aliases.get("-".join(parts[:2]), ""),
                  aliases.get(parts[0], "")]
    for c in candidates:
        if c and c in langs:
            return c
    return None


@lru_cache(maxsize=2048)
def to_ipa(text: str, bcp47: str) -> dict:
    from phonemizer import phonemize
    from phonemizer.separator import Separator

    lang = resolve_language(bcp47)
    if lang is None:
        return {"supported": False, "ipa": None, "words": []}
    words = text.split()
    out = phonemize(words, language=lang, backend="espeak", strip=True,
                    separator=Separator(phone="", word=" "), preserve_punctuation=False,
                    language_switch="remove-flags")
    return {"supported": True, "espeak_lang": lang, "ipa": " ".join(out),
            "words": [{"word": w, "ipa": p} for w, p in zip(words, out)]}
