import { cn } from '@/lib/utils/cn';

/**
 * A deterministic sample account. Marked as illustrative in the caption —
 * it is reference data for the marketing page, not fabricated user metrics.
 */
const DAILY_RETURNS = [
  0.4, 1.1, -0.6, 0.9, 2.2, -1.4, 0.3, 1.8, -0.2, 0.7, -2.1, -1.3, 0.5, 1.6, 2.4, -0.8,
  0.2, -1.9, -2.6, -0.4, 0.9, -1.1, -3.2, 0.6, 1.2, -0.7, 2.1, 0.4, -0.3, 1.5, 2.8, 1.1,
  -0.9, 0.8, 2.3, 1.7, -0.5, 1.9, 0.6, 2.6,
];

const W = 900;
const H = 260;
const SPLIT = 168; // equity above, underwater below
const UW_TOP = SPLIT + 12;
const UW_HEIGHT = H - SPLIT - 24;

function buildSeries() {
  let balance = 100;
  let peak = 100;
  const equity: number[] = [];
  const underwater: number[] = [];

  for (const r of DAILY_RETURNS) {
    balance *= 1 + r / 100;
    peak = Math.max(peak, balance);
    equity.push(balance);
    underwater.push(((balance - peak) / peak) * 100);
  }
  return { equity, underwater };
}

function toPath(values: number[], top: number, height: number, min: number, max: number) {
  const span = max - min || 1;
  const step = W / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = top + height - ((v - min) / span) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function EquityUnderwater({ className }: { className?: string }) {
  const { equity, underwater } = buildSeries();

  const eqMin = Math.min(...equity);
  const eqMax = Math.max(...equity);
  const equityPath = toPath(equity, 8, SPLIT - 16, eqMin, eqMax);

  const uwMin = Math.min(...underwater);
  // Range runs from the worst drawdown up to zero, so 0% lands on UW_TOP and
  // the trough hangs at the bottom — the curve mirrors the dip above it.
  const underwaterPath = toPath(underwater, UW_TOP, UW_HEIGHT, uwMin, 0);
  const underwaterFill = `${underwaterPath} L${W},${UW_TOP} L0,${UW_TOP} Z`;

  return (
    <figure className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Equity curve rising to a new high, with the underwater curve below showing a maximum drawdown of 11.4 percent lasting 37 days."
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="eq-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-iris-400)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-iris-400)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={`${equityPath} L${W},${SPLIT - 8} L0,${SPLIT - 8} Z`}
          fill="url(#eq-fade)"
        />
        <path
          d={equityPath}
          fill="none"
          stroke="var(--color-iris-400)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        <line
          x1="0"
          x2={W}
          y1={SPLIT}
          y2={SPLIT}
          stroke="var(--color-line)"
          strokeDasharray="3 4"
        />

        <path d={underwaterFill} fill="var(--color-loss)" fillOpacity="0.14" />
        <path
          d={underwaterPath}
          fill="none"
          stroke="var(--color-loss)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="mt-3 text-2xs text-fg-subtle">
        Illustrative account · 40 sessions · high-water mark in dashes
      </figcaption>
    </figure>
  );
}