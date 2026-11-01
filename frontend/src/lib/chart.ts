/** Shared Recharts styling — values reference the CSS tokens in index.css. */
export const axisProps = {
  stroke: "var(--axis)",
  tick: { fill: "var(--muted)", fontSize: 12 },
  tickLine: false,
} as const;

export const gridProps = { stroke: "var(--grid)", strokeDasharray: "0", vertical: false } as const;

export const tooltipProps = {
  contentStyle: {
    background: "var(--surface-solid)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "var(--shadow)",
    color: "var(--ink)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--ink-2)" },
  cursor: { stroke: "var(--axis)" },
} as const;
