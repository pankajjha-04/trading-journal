# Ledgerline — Trading Journal

Next.js 15 · TypeScript · Supabase · Tailwind v4

## Run it

```bash
npm install
cp .env.example .env.local        # fill in Supabase URL + anon key
supabase db push                  # applies 0001_schema.sql then 0002_rls.sql
npm run test                      # 19 tests, domain layer
npm run typecheck
npm run dev
```

---

## What is built (Phase 1 + 2 foundation)

| Area | File | State |
|---|---|---|
| Design tokens | `src/app/globals.css` | Complete — dark + light, one token set |
| Type scale, fonts | `src/lib/fonts.ts` | Complete |
| Domain types | `src/lib/types/trade.ts` | Complete |
| P&L engine | `src/lib/metrics/trade.ts` | Complete, tested |
| Portfolio stats | `src/lib/metrics/portfolio.ts` | Complete, tested |
| Risk ratios | `src/lib/metrics/risk.ts` | Complete, tested |
| Validation | `src/lib/validations/trade.ts` | Complete |
| Formatting | `src/lib/utils/format.ts` | Complete |
| Schema + triggers | `supabase/migrations/0001_schema.sql` | Complete |
| RLS + storage | `supabase/migrations/0002_rls.sql` | Complete |
| Auth clients | `src/lib/supabase/*` | Complete |
| Route protection | `src/middleware.ts` | Complete |
| UI primitives | `src/components/ui/*` | Button, Card, Skeleton, EmptyState, StatCard |
| Landing hero | `src/app/page.tsx` | Complete, zero client JS |
| Security headers | `next.config.ts` | CSP, HSTS, frame-deny |

## Not yet built

Auth screens · dashboard shell · trade table · trade form · importers ·
analytics pages · AI review · reports · admin · payments · PWA manifest ·
service worker · e2e tests.

---

## Decisions worth knowing before you extend this

**Nulls, not zeros.** Every metric returns `null` when it is undefined —
profit factor with no losses, Sharpe on 12 trades, R-multiple with no stop.
The UI renders `—`. A journal that shows `Infinity` or `0.0` where it means
"not enough data" teaches traders the wrong lesson.

**Ratios are withheld below 20 daily observations.** A Sharpe computed on a
week of trading is noise with a decimal point.

**R-multiple is never inferred.** If a trade had no stop, risk is unknown.
Back-filling it from the realised loss would make every loser look like a
disciplined −1R.

**Scratches are their own category.** Breakeven trades are excluded from the
win-rate denominator and break both streak counters.

**Costs hit R, not just P&L.** Fees are subtracted before the R-multiple is
computed, so a scalping strategy's real edge shows up.

**Drawdown is peak-to-trough on the equity curve**, ordered by close time —
not first-to-last balance, and not dependent on the order rows arrive in.

**`getUser()` in middleware, never `getSession()`.** `getSession` decodes the
cookie without contacting the auth server and can be forged.

**Two layers of ownership.** RLS stops a user *reading* others' rows;
`assert_owned_account()` stops them *writing* a trade onto someone else's
account, which RLS alone permits.

**Service-role key is webhook-only.** It bypasses RLS. It must never appear in
a route a user can reach.

**Subscriptions are read-only to the client.** Plan grants come from webhooks
on the service role. A client that can write its own subscription row can
grant itself Lifetime.

**Tabular figures everywhere.** `font-variant-numeric: tabular-nums` on all
numeric output so decimal points align down a column.

**P&L colours are reserved.** Mint and rose mean profit and loss and nothing
else; iris carries all interaction. No green "success" toasts.

**The animated counter is `aria-hidden`**, with a static `sr-only` copy —
otherwise screen readers announce sixty intermediate values.

---

## Where the Lighthouse budget goes

- Hero is a server component with an inline SVG — no chart library, no client
  JS, no CLS. LCP is text.
- `optimizePackageImports` on `lucide-react`, `recharts`, `date-fns`,
  `framer-motion`.
- Recharts must be `dynamic(..., { ssr: false })` at every call site. It is
  ~90 kB gzipped and belongs to the dashboard route only.
- Theme is applied by a blocking inline script before paint — no flash, and
  no hydration mismatch.
- Fonts use `display: swap` and are self-hosted by `next/font`.

## Next module

Auth screens (`/login`, `/signup`, `/forgot-password`, callback route) —
they depend only on what already exists here.
