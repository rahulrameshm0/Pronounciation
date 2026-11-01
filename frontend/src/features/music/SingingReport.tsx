import { BarChart3, Clock, Music2, Sparkles, Table2, Target, Waves } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, ScoreBadge, ScoreRing, StatTile } from "../../components/ui";
import type { NoteResult, SingingAnalysis } from "../../lib/api";
import { axisProps, gridProps, tooltipProps } from "../../lib/chart";
import { midiToName } from "../../lib/notes";

const centsColor = (c: number) => (Math.abs(c) <= 15 ? "var(--neutral)" : c < 0 ? "var(--flat)" : "var(--sharp)");
const centsText = (c: number) => (Math.abs(c) <= 15 ? "in tune" : c < 0 ? `${Math.abs(c)}¢ flat` : `${c}¢ sharp`);

export function SingingReport({ data }: { data: SingingAnalysis }) {
  const heard = data.notes.filter((n) => n.heard);
  const bars = data.notes.map((n) => ({
    label: `${n.index + 1}·${n.name}`,
    cents: n.heard ? Math.max(-100, Math.min(100, n.cents_off!)) : 0,
    note: n,
  }));
  const targetLine = data.notes.flatMap((n) => [
    { t: n.start, target: n.midi },
    { t: n.start + n.duration, target: n.midi },
    { t: n.start + n.duration + 0.001, target: null },
  ]);
  const first = data.notes[0]?.start ?? 0;
  const last = data.notes.length ? data.notes.at(-1)!.start + data.notes.at(-1)!.duration : 1;
  const contour = data.contour.filter((p) => p.t >= first - 0.5 && p.t <= last + 0.5);
  const midis = data.notes.map((n) => n.midi);
  const avgInTune = heard.length ? Math.round(heard.reduce((s, n) => s + n.in_tune_pct!, 0) / heard.length) : null;

  return (
    <>
      <Card title="Singing result" icon={Sparkles}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ScoreRing score={data.overall_score} caption="Pitch accuracy across all notes" />
          {data.octave_shift !== 0 && (
            <p className="text-sm text-ink-2">
              You sang {Math.abs(data.octave_shift)} octave{Math.abs(data.octave_shift) > 1 ? "s" : ""}{" "}
              {data.octave_shift > 0 ? "higher" : "lower"} — scored in your octave.
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Target} label="Notes hit" value={`${heard.length}/${data.notes.length}`} />
          <StatTile icon={Clock} label="Time in tune (±50¢)" value={avgInTune} unit="%" />
          <StatTile
            icon={Waves}
            label="Vibrato rate"
            value={data.vibrato.rate_hz}
            unit="Hz"
            note={data.vibrato.rate_hz ? "natural range is 4.5–7 Hz" : "none detected on long notes"}
          />
          <StatTile icon={Waves} label="Vibrato width" value={data.vibrato.extent_cents} unit="¢" />
        </div>
        <ul className="mt-5 space-y-2">
          {data.tips.map((t) => (
            <li key={t} className="flex gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Pitch vs target" icon={Music2}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[first - 0.5, last + 0.5]}
                unit="s"
                allowDuplicatedCategory={false}
                tickFormatter={(t) => t.toFixed(1)}
                {...axisProps}
              />
              <YAxis
                type="number"
                domain={[Math.min(...midis) - 3, Math.max(...midis) + 3]}
                tickFormatter={(m) => midiToName(m)}
                allowDecimals={false}
                width={44}
                {...axisProps}
              />
              <Tooltip
                {...tooltipProps}
                labelFormatter={(t) => `${Number(t).toFixed(2)} s`}
                formatter={(v: number, name: string) => [
                  name === "You" ? `${midiToName(v)} ${Math.round((v - Math.round(v)) * 100)}¢` : midiToName(v),
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
              <Line
                data={targetLine}
                dataKey="target"
                name="Target"
                stroke="var(--neutral)"
                strokeWidth={6}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                data={contour}
                dataKey="midi"
                name="You"
                stroke="var(--series-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Cents off per note" subtitle="100¢ = one semitone" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bars} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <ReferenceArea y1={-50} y2={50} fill="var(--good)" fillOpacity={0.06} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <XAxis dataKey="label" {...axisProps} interval={0} fontSize={10} />
              <YAxis domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} unit="¢" width={48} {...axisProps} />
              <Tooltip
                {...tooltipProps}
                cursor={{ fill: "var(--grid)", fillOpacity: 0.4 }}
                formatter={(_v, _n, item) => {
                  const n = (item.payload as { note: NoteResult }).note;
                  return [n.heard ? `${centsText(n.cents_off!)} · sang ${n.sung_name}` : "not heard", n.name];
                }}
              />
              <Bar dataKey="cents" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={false}>
                {bars.map((b, i) => (
                  <Cell key={i} fill={b.note.heard ? centsColor(b.cents) : "transparent"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
            <LegendSwatch color="var(--flat)" label="Flat (below)" />
            <LegendSwatch color="var(--sharp)" label="Sharp (above)" />
            <LegendSwatch color="var(--neutral)" label="In tune (±15¢)" />
            <span>Shaded band = ±50¢</span>
          </div>
        </Card>
      </div>

      <Card title="Note by note" icon={Table2}>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                {["#", "Target", "You sang", "Pitch", "In tune", "Stability", "Late by", "Score"].map((h) => (
                  <th key={h} className="border-b border-line px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.notes.map((n) => (
                <tr key={n.index} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 text-muted">{n.index + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{n.name}</td>
                  <td className="px-3 py-2.5">{n.heard ? n.sung_name : "—"}</td>
                  <td className="px-3 py-2.5">{n.heard ? centsText(n.cents_off!) : "not heard"}</td>
                  <td className="px-3 py-2.5">{n.heard ? `${n.in_tune_pct}%` : "—"}</td>
                  <td className="px-3 py-2.5">{n.heard ? `±${n.stability_cents}¢` : "—"}</td>
                  <td className="px-3 py-2.5">{n.onset_delay != null ? `${n.onset_delay}s` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={n.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
