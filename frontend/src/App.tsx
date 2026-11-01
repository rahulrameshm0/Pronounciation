import { Activity, AudioWaveform, Languages, Music2 } from "lucide-react";
import { useState } from "react";
import { MusicPage } from "./features/music/MusicPage";
import { PronunciationPage } from "./features/pronunciation/PronunciationPage";
import { VocalPage } from "./features/vocal/VocalPage";
import { load, save } from "./lib/storage";

const TABS = [
  { id: "pronunciation", label: "Pronunciation", icon: Languages, Page: PronunciationPage },
  { id: "voice", label: "Voice", icon: Activity, Page: VocalPage },
  { id: "singing", label: "Singing", icon: Music2, Page: MusicPage },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<TabId>(() => {
    const fromHash = location.hash.slice(1);
    return TABS.some((t) => t.id === fromHash) ? (fromHash as TabId) : load<TabId>("voicecoach.tab", "pronunciation");
  });
  const { Page } = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="gradient-bg grid h-9 w-9 place-items-center rounded-xl text-white shadow-md">
              <AudioWaveform size={20} strokeWidth={2.4} />
            </span>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight">VoiceCoach</div>
              <div className="hidden text-[11px] text-muted sm:block">Speak · Analyse · Sing</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    save("voicecoach.tab", t.id);
                    history.replaceState(null, "", `#${t.id}`);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition sm:px-4 ${
                    active ? "bg-surface-solid text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <t.icon size={15} strokeWidth={2.3} className={active ? "text-accent" : ""} />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main key={tab} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Page />
      </main>
    </div>
  );
}
