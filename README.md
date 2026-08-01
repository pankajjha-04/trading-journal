# Ledgerline

A trading journal that tells you which of your setups actually makes money —
and which ones the profitable ones have been quietly funding.

Next.js 15 (App Router) · TypeScript · Supabase · Tailwind v4 · 216 tests

---

## Run it

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run test                   # 216 tests
npm run dev
```

Then run every migration in `supabase/migrations/` **in order** through the
Supabase SQL Editor. They are not applied automatically — paste the contents of
each file and run it:

| File | What it adds |
|---|---|
| `0001_schema.sql` | 16 tables, enums, triggers, seed plans |
| `0002_rls.sql` | Row-level security, storage policies, `assert_owned_account()` |
| `0003_fixes.sql` | Dedupe index fix, broker name normalisation |
| `0004_newsletter.sql` | Newsletter table |
| `0005_billing.sql` | Payments, invoices, GST invoice numbering |
| `0006_subscription_fixes.sql` | Upsert constraint fix, crypto as a provider |

### Environment

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Admin pages and payment webhooks. Bypasses RLS entirely —
# never expose it to the client, never prefix it with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# AI review and coach. Leave AI_MODEL blank to track the provider's
# current fast model rather than pinning a version that gets retired.
AI_PROVIDER=gemini          # gemini | anthropic | groq | openrouter
AI_MODEL=
GEMINI_API_KEY=

# Payments. Each method appears only when its keys are present,
# so you can launch with one and add the others later.
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
```

---

## What it does

**Journal** — 24-field trade form with a live risk preview, sortable and
filterable table, numbered pagination, screenshots attached per trade.

**Two importers.** A per-trade CSV importer (Binance, Bybit, OKX, MT4, MT5)
with a hand-written RFC4180 parser, delimiter detection and European decimals.
And an order-history importer that rebuilds positions from raw fills by FIFO
netting — for the many brokers that export orders rather than positions.

Both work out each symbol's contract size from the broker's own P&L column.
One account routinely mixes gold at 100 ounces a lot, forex at 100,000 units
and crypto at 1; no export states it outright, and assuming one value makes
every number in the journal wrong.

**Analytics** — equity curve with the underwater curve beneath it, R
distribution, P&L calendar, and eight breakdown tables (setup, session,
weekday, symbol, direction, timeframe, emotion, confidence).

**Calendar** — month grid coloured by daily P&L, day detail, best and worst
day, longest green and red runs.

**Goals** — six metrics across four periods. Max-risk goals are treated as
ceilings, not targets.

**Reflect** — a daily journal with mood and discipline ratings. The streak
counts days you wrote something, not days you traded.

**AI** — provider-agnostic adapter (Gemini, Anthropic, Groq, OpenRouter behind
one env var). Per-trade review, a coach tab with six preset questions,
clipboard paste for chart screenshots, and PDF/Excel/CSV analysis.

**Reports** — period reports, print stylesheet, CSV export, Excel export with
three sheets, full JSON backup.

**Billing** — Razorpay, Stripe and crypto. GST-inclusive invoicing with
sequential numbering per Indian financial year.

**Admin** — signups, MRR, revenue by month, user search, manual plan grants.

---

## Decisions worth knowing

These are the choices a new reader would otherwise assume were mistakes.

**Nulls, not zeros.** Profit factor with no losing trades is undefined, not
infinity and not zero — the UI shows a dash. Sharpe waits for twenty trading
days. A trade with no stop has no R, and none is invented for it: back-filling
from the realised loss would make every loser look like a disciplined −1R.

**Risk is signed.** A stop trailed past entry has locked in profit, so there is
no risk left to divide by and R stays undefined rather than inverting.

**Costs come out before R**, not after.

**Scratches are excluded** from the win-rate denominator and break both streak
counters. They are neither a win nor a loss.

**Drawdown is peak-to-trough**, ordered by close time — not first-to-last.

**Small groups are flagged, not hidden.** A two-trade setup reading 100% gets a
marker and a footnote rather than being dropped.

**`getUser()` in middleware, never `getSession()`.** The latter decodes a
cookie the browser could have forged.

**Two ownership layers.** RLS on every table, plus an `assert_owned_account()`
trigger. The service-role key is used in exactly two places: payment webhooks
and admin aggregates.

**Export is never gated.** The free plan caps trades at 50, but hitting the cap
never locks your existing data — it stays readable and exportable. A journal
that holds your data hostage is not a journal.

**`past_due` keeps working.** A failed renewal is usually a bank decline, not a
decision to leave.

**Webhook signatures are verified in constant time**, with Stripe's timestamp
tolerance checked against replay. Crypto activates only on `finished`, never
`confirmed` — a confirmed payment can still be reorged away.

**Every webhook event id is stored with a unique index.** Providers retry for
days; without it a retry would extend a subscription twice.

**No fake social proof.** No testimonials, trust badges or user counters,
because there are no users yet. The landing page argues with real output from
the sample dataset instead — a losing setup sitting inside a profitable
account.

---

## Testing

```bash
npm run test
```

216 tests across 13 files: the P&L engine, portfolio stats, risk ratios,
breakdowns, both importers, contract-size inference, CSV export escaping, AI
output validation, goals, calculators, pagination, billing entitlements,
webhook signature verification, admin metrics, and a 200-trade end-to-end
fixture whose expected numbers are documented and matched exactly by the UI.

---

## Not built yet

- **Security**: email change, 2FA, session revoke
- **Billing**: customer portal (change card, cancel in-app), coupons, refunds
- **Importers**: detection that tells you a file is an order history before you
  import it in the wrong mode
- **Production**: the rate limiter is an in-process Map — it resets on restart
  and does not work across instances. Move to Redis before launch.

### One thing to fix before real users

Google's free Gemini tier uses prompts to improve their models outside the
EU/UK/EEA. Your users' entries, exits and private notes would go into that, and
the landing page promises the opposite. Switch `AI_PROVIDER` to a paid provider
before anyone else's data goes through it — that is the entire reason it is one
environment variable.
