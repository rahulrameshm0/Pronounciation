import { BookOpen, Globe, Snail, Sparkles, Target, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPhonemes, type Phonemes } from "../../lib/api";
import { load, save } from "../../lib/storage";
import { Button, Card, Chip, ErrorNote, MicButton, ScoreBadge, ScoreRing, scoreBand } from "../../components/ui";
import { LANGUAGES } from "./languages";
import { scoreAttempt, normalize, type Attempt } from "./scoring";
import { listenOnce, speak, speechSynthesisSupported } from "./speech";
import { starterFor } from "./words";

type WordStats = { attempts: number; best: number; last: number };
type History = Record<string, Record<string, WordStats>>; // lang -> word -> stats
type Phase = "idle" | "listening" | "analysing";

const HISTORY_KEY = "voicecoach.pronunciation.history";

export function PronunciationPage() {
  const [lang, setLang] = useState(() => load("voicecoach.lang", "en-US"));
  const [text, setText] = useState(() => starterFor(load("voicecoach.lang", "en-US"))[0] ?? "");
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ipa, setIpa] = useState<Phonemes | null>(null);
  const [history, setHistory] = useState<History>(() => load(HISTORY_KEY, {}));
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => save("voicecoach.lang", lang), [lang]);
  useEffect(() => () => stopRef.current(), []);

  useEffect(() => {
    setIpa(null);
    if (!text.trim()) return;
    let cancelled = false;
    getPhonemes(text, lang)
      .then((p) => !cancelled && setIpa(p))
      .catch(() => !cancelled && setIpa(null));
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  const starter = starterFor(lang);
  const langHistory = history[lang] ?? {};
  const weak = useMemo(
    () =>
      Object.entries(langHistory)
        .filter(([, s]) => s.last < 70)
        .sort((a, b) => a[1].last - b[1].last)
        .slice(0, 12)
        .map(([w]) => w),
    [langHistory],
  );
  const practiced = Object.keys(langHistory).length;

  function choose(word: string) {
    setText(word);
    setAttempt(null);
    setError(null);
  }

  function changeLang(next: string) {
    setLang(next);
    setText(starterFor(next)[0] ?? "");
    setAttempt(null);
    setError(null);
  }

  async function record() {
    if (phase === "listening") {
      stopRef.current();
      return;
    }
    setError(null);
    setAttempt(null);
    setPhase("listening");
    const { result, stop } = listenOnce(lang, {
      onLevel: (l) => setLevel((prev) => (Math.abs(prev - l) > 0.04 ? l : prev)), onStop: () => setPhase("analysing") });
    stopRef.current = stop;
    try {
      const heard = await result;
      if (!heard.transcript.trim()) {
        setError("Didn't catch that — try again a little louder.");
        return;
      }
      const scored = scoreAttempt(text, heard, lang);
      setAttempt(scored);
      setHistory((prev) => {
        const forLang = { ...(prev[lang] ?? {}) };
        for (const w of scored.words) {
          const old = forLang[w.target] ?? { attempts: 0, best: 0, last: 0 };
          forLang[w.target] = { attempts: old.attempts + 1, best: Math.max(old.best, w.score), last: w.score };
        }
        const next = { ...prev, [lang]: forLang };
        save(HISTORY_KEY, next);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
      setLevel(0);
    }
  }

  const ipaByWord = new Map(ipa?.words.map((w) => [normalize(w.word), w.ipa]) ?? []);
  const status =
    phase === "listening"
      ? "Listening… pause when you're done"
      : phase === "analysing"
        ? "Analysing your pronunciation…"
        : "Tap the mic and say the word";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="rise relative overflow-hidden rounded-[2rem] border border-line bg-surface p-6 shadow-card backdrop-blur-xl sm:p-10 min-w-0">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[var(--glow-1)] blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              <Target size={13} strokeWidth={2.4} /> Say this
            </span>
            <h1
              className="gradient-text mt-5 max-w-full text-5xl font-extrabold tracking-tight break-words sm:text-6xl"
              lang={lang}
            >
              {text || "—"}
            </h1>
            <div className="mt-3 h-7">
              {ipa?.supported && ipa.ipa && (
                <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-sm text-ink-2">/{ipa.ipa}/</span>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3 sm:gap-5">
              <Button
                icon={Volume2}
                onClick={() => void speak(text, lang)}
                disabled={!text || !speechSynthesisSupported}
              >
                <span className="hidden sm:inline">Listen</span>
              </Button>
              <MicButton
                recording={phase === "listening"}
                busy={phase === "analysing"}
                level={level}
                onClick={record}
                disabled={!text}
                label={phase === "listening" ? "Stop recording" : "Record pronunciation"}
              />
              <Button
                icon={Snail}
                onClick={() => void speak(text, lang, 0.6)}
                disabled={!text || !speechSynthesisSupported}
              >
                <span className="hidden sm:inline">Slow</span>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted">{status}</p>
            <ErrorNote message={error} />
          </div>
        </section>

        {attempt && (
          <Card title="Your result" icon={Sparkles}>
            <ScoreRing
              score={attempt.overall}
              caption={attempt.transcript ? `We heard “${attempt.transcript}”` : undefined}
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {attempt.words.map((w, i) => {
                const band = scoreBand(w.score);
                return (
                  <div key={i} className="rise rounded-2xl bg-surface-2/70 p-4" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-semibold" lang={lang}>
                          {w.target}
                        </div>
                        {ipaByWord.get(w.target) && (
                          <div className="font-mono text-xs text-muted">/{ipaByWord.get(w.target)}/</div>
                        )}
                      </div>
                      <ScoreBadge score={w.score} />
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--grid)]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${w.score}%`, background: band.color }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-ink-2">
                      {w.heardAs == null
                        ? "Not heard"
                        : w.similarity === 1
                          ? `${band.label} · clarity ${Math.round(w.clarity * 100)}%`
                          : `Sounded like “${w.heardAs}”`}
                    </div>
                    <button
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent"
                      onClick={() => void speak(w.target, lang, 0.7)}
                    >
                      <Volume2 size={12} /> Hear it
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card title="Language" subtitle={`${LANGUAGES.length} languages`} icon={Globe}>
          <select value={lang} onChange={(e) => changeLang(e.target.value)} className="field">
            {LANGUAGES.map(([code, name, native]) => (
              <option key={code} value={code}>
                {name} — {native}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Works in every modern browser. Your recording is transcribed on the VoiceCoach server.
          </p>
        </Card>

        <Card title="Word library" subtitle={practiced ? `${practiced} practised` : "Pick or type a word"} icon={BookOpen}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) choose(draft.trim());
              setDraft("");
            }}
            className="mb-5 flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type any word or sentence…"
              className="field min-w-0 flex-1"
            />
            <Button type="submit" variant="primary">
              Use
            </Button>
          </form>
          {weak.length > 0 && (
            <WordChips label="Needs practice" words={weak} stats={langHistory} onPick={choose} current={text} />
          )}
          {starter.length > 0 ? (
            <WordChips label="Starter words" words={starter} stats={langHistory} onPick={choose} current={text} />
          ) : (
            <p className="text-xs text-muted">No starter list for this language yet — type your own words above.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function WordChips({
  label,
  words,
  stats,
  onPick,
  current,
}: {
  label: string;
  words: string[];
  stats: Record<string, WordStats>;
  onPick: (w: string) => void;
  current: string;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => {
          const s = stats[normalize(w)];
          return (
            <Chip key={w} active={current === w} onClick={() => onPick(w)}>
              {s && current !== w && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: scoreBand(s.last).color }} />
              )}
              {w}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
