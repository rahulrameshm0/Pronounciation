import type { Transcript } from "../../lib/api";
import { isUnspaced } from "./languages";

export type WordScore = { target: string; heardAs: string | null; similarity: number; clarity: number; score: number };
export type Attempt = { words: WordScore[]; overall: number; transcript: string };

export function normalize(text: string) {
  return text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string[], b: string[]) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** 0..1 similarity on code points (so combining marks in Indic scripts count per point). */
export function similarity(a: string, b: string) {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const len = Math.max(ca.length, cb.length);
  return len === 0 ? 1 : 1 - levenshtein(ca, cb) / len;
}

type Span = { text: string; prob: number };
type Token = { text: string; prob: number };

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Whisper's words with their probabilities, or the plain transcript split on spaces. */
function tokensOf(heard: Transcript): Token[] {
  const source = heard.words.length
    ? heard.words.map((w) => ({ text: normalize(w.word), prob: w.probability }))
    : normalize(heard.transcript)
        .split(" ")
        .map((text) => ({ text, prob: heard.confidence || 0.75 }));
  return source.flatMap((t) => t.text.split(" ").filter(Boolean).map((text) => ({ text, prob: t.prob })));
}

/**
 * Spans a target word could match: runs of 1–3 heard words (a mispronounced word is often split,
 * e.g. "comfortable" → "come for table"), or character windows for unspaced scripts.
 */
function candidates(tokens: Token[], target: string, unspaced: boolean): Span[] {
  const out: Span[] = [];
  if (unspaced) {
    const chars = tokens.flatMap((t) => Array.from(t.text).map((c) => ({ c, prob: t.prob })));
    const n = Array.from(target).length;
    for (let w = Math.max(1, n - 1); w <= n + 1; w++)
      for (let i = 0; i + w <= chars.length; i++) {
        const slice = chars.slice(i, i + w);
        out.push({ text: slice.map((x) => x.c).join(""), prob: mean(slice.map((x) => x.prob)) });
      }
    return out;
  }
  for (let len = 1; len <= 3; len++)
    for (let i = 0; i + len <= tokens.length; i++) {
      const slice = tokens.slice(i, i + len);
      out.push({ text: slice.map((t) => t.text).join(" "), prob: mean(slice.map((t) => t.prob)) });
    }
  return out;
}

export function scoreAttempt(targetText: string, heard: Transcript, lang: string): Attempt {
  const unspaced = isUnspaced(lang);
  const tokens = tokensOf(heard);
  const targets = normalize(targetText).split(" ").filter(Boolean);

  const words = targets.map<WordScore>((target) => {
    let best: (Span & { sim: number }) | null = null;
    for (const span of candidates(tokens, target, unspaced)) {
      const sim = similarity(target, span.text.replace(/ /g, ""));
      if (!best || sim > best.sim || (sim === best.sim && span.prob > best.prob)) best = { ...span, sim };
    }
    if (!best || best.sim < 0.34) return { target, heardAs: null, similarity: 0, clarity: 0, score: 0 };
    // Similarity = did it sound like the word; Whisper's word probability = how clearly.
    // Whisper rarely exceeds ~0.85 on isolated words even when they're perfect, so rescale.
    const clarity = Math.min(1, best.prob / 0.85);
    const score = Math.round((0.7 * best.sim + 0.3 * clarity * best.sim) * 100);
    return { target, heardAs: best.text, similarity: best.sim, clarity, score };
  });

  const overall = words.length ? Math.round(mean(words.map((w) => w.score))) : 0;
  return { words, overall, transcript: heard.transcript };
}
