/**
 * Report charts, drawn as inline SVG with no library.
 *
 * Two shapes cover every monthly HR report Certly produces: grouped bars for
 * "this versus that, by category" and a single horizontal stack for "how the
 * total breaks down". They are server components, so a report page renders
 * complete HTML with the chart already in it, prints correctly, and needs no
 * client JavaScript to show a number.
 */

export const CHART_COLOURS = {
  ink: "#161616",
  red: "#B91C1C",
  slate: "#6B7280",
  sand: "#C9C2B6",
  amber: "#B45309",
  green: "#15803D",
} as const;

export interface BarSeries {
  name: string;
  colour: string;
  values: number[];
}

export interface GroupedBarsProps {
  categories: string[];
  series: BarSeries[];
  height?: number;
  title?: string;
  valueSuffix?: string;
  /** Draw a dashed divider after this category index, for a year boundary. */
  dividerAfter?: number;
}

export function GroupedBars({
  categories,
  series,
  height = 260,
  title,
  valueSuffix = "",
  dividerAfter,
}: GroupedBarsProps) {
  const padL = 36;
  const padR = 12;
  const padT = title ? 28 : 12;
  const padB = 44;
  const width = Math.max(480, categories.length * 56 + padL + padR);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = niceCeil(max);
  const ticks = 4;

  const groupW = plotW / Math.max(1, categories.length);
  const barGap = 4;
  const barW = Math.max(6, (groupW - barGap * (series.length + 1)) / Math.max(1, series.length));

  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={title ?? "Bar chart"}
          style={{ fontFamily: "inherit", display: "block" }}
        >
          {title ? (
            <text x={padL} y={18} fontSize={12} fontWeight={700} fill={CHART_COLOURS.ink}>
              {title}
            </text>
          ) : null}

          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = (niceMax / ticks) * i;
            const yy = y(v);
            return (
              <g key={i}>
                <line x1={padL} x2={width - padR} y1={yy} y2={yy} stroke="#E5E0D8" strokeWidth={1} />
                <text x={padL - 6} y={yy + 4} fontSize={10} textAnchor="end" fill={CHART_COLOURS.slate}>
                  {Number.isInteger(v) ? v : v.toFixed(1)}
                </text>
              </g>
            );
          })}

          {categories.map((cat, ci) => {
            const gx = padL + ci * groupW;
            return (
              <g key={cat}>
                {series.map((s, si) => {
                  const v = s.values[ci] ?? 0;
                  const x = gx + barGap + si * (barW + barGap);
                  const top = y(v);
                  const h = Math.max(0, padT + plotH - top);
                  return (
                    <g key={s.name}>
                      <rect x={x} y={top} width={barW} height={h} fill={s.colour} rx={1} />
                      {v > 0 ? (
                        <text
                          x={x + barW / 2}
                          y={top - 4}
                          fontSize={9}
                          textAnchor="middle"
                          fill={CHART_COLOURS.ink}
                          fontWeight={600}
                        >
                          {v}
                          {valueSuffix}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <text
                  x={gx + groupW / 2}
                  y={padT + plotH + 16}
                  fontSize={10}
                  textAnchor="middle"
                  fill={CHART_COLOURS.ink}
                >
                  {cat}
                </text>
                {dividerAfter !== undefined && ci === dividerAfter ? (
                  <line
                    x1={gx + groupW}
                    x2={gx + groupW}
                    y1={padT}
                    y2={padT + plotH}
                    stroke={CHART_COLOURS.slate}
                    strokeDasharray="4 4"
                  />
                ) : null}
              </g>
            );
          })}

          <line
            x1={padL}
            x2={width - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={CHART_COLOURS.ink}
            strokeWidth={1}
          />

          {series.map((s, i) => (
            <g key={s.name} transform={`translate(${padL + i * 140}, ${height - 10})`}>
              <rect x={0} y={-9} width={10} height={10} fill={s.colour} />
              <text x={14} y={0} fontSize={10} fill={CHART_COLOURS.ink}>
                {s.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

export interface StackSegment {
  label: string;
  value: number;
  colour: string;
}

export function StackedBar({
  segments,
  title,
  height = 22,
}: {
  segments: StackSegment[];
  title?: string;
  height?: number;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  return (
    <figure className="m-0">
      {title ? <figcaption className="text-xs font-bold mb-1.5">{title}</figcaption> : null}
      <div
        className="w-full flex overflow-hidden rounded-sm border border-[var(--brand-line)]"
        style={{ height }}
        role="img"
        aria-label={title ?? "Breakdown"}
      >
        {total === 0 ? (
          <div className="w-full bg-[var(--brand-cream)]" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                style={{ width: `${(s.value / total) * 100}%`, background: s.colour }}
                title={`${s.label}: ${s.value}`}
              />
            ))
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.colour }} />
            <span className="text-[var(--brand-slate)]">{s.label}</span>
            <span className="font-bold">{s.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
