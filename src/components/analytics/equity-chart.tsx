'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/format';
import type { EquityPoint } from '@/lib/metrics';

/**
 * The only chart in the product that earns a library: hover-to-inspect on a
 * dense series is genuinely hard to hand-roll. Everything else here is CSS.
 * Loaded via dynamic import so recharts never reaches another route.
 */
export function EquityChart({
  points,
  currency,
  startingBalance,
}: {
  points: EquityPoint[];
  currency: string;
  startingBalance: number;
}) {
  const data = [
    { at: 'Start', balance: startingBalance, drawdown: 0 },
    ...points.map((p) => ({
      at: new Date(p.at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
      balance: Number(p.balance.toFixed(2)),
      drawdown: Number((-p.drawdown).toFixed(2)),
    })),
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-iris-400)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-iris-400)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="at"
            tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
            tickLine={false}
            axisLine={false}
            width={64}
            // Anchoring at zero squashes the curve into a flat band; the
            // interesting range is the account's own high and low.
            domain={[
              (min: number) => Math.floor(min * 0.97),
              (max: number) => Math.ceil(max * 1.03),
            ]}
            tickFormatter={(value: number) =>
              formatCurrency(value, currency, { compact: true })
            }
          />
          {/* Breakeven, not zero — the line that actually matters. */}
          <ReferenceLine
            y={startingBalance}
            stroke="var(--color-fg-subtle)"
            strokeDasharray="4 4"
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-line-strong)' }}
            contentStyle={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-line)',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-fg-muted)' }}
            formatter={(value, name) => [
              formatCurrency(typeof value === 'number' ? value : null, currency),
              name === 'balance' ? 'Balance' : 'Drawdown',
            ]}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--color-iris-400)"
            strokeWidth={2}
            fill="url(#equity-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
