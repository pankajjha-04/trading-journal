import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { computeStreak } from '@/lib/metrics';
import { ReflectionForm, type ReflectionRecord } from '@/components/reflect/reflection-form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Reflect',
  robots: { index: false, follow: false },
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default async function ReflectPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const today = isoDate(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : today;

  const [{ data: entry }, { data: history }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('entry_date, pre_market, reflection, mood, discipline, followed_rules, meditated')
      .eq('user_id', user.id)
      .eq('entry_date', date)
      .maybeSingle(),
    supabase
      .from('journal_entries')
      .select('entry_date, discipline, followed_rules')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(400),
  ]);

  const record: ReflectionRecord | null = entry
    ? {
        entryDate: entry.entry_date,
        preMarket: entry.pre_market,
        reflection: entry.reflection,
        mood: entry.mood,
        discipline: entry.discipline,
        followedRules: entry.followed_rules,
        meditated: entry.meditated,
      }
    : null;

  const streak = computeStreak({ dates: (history ?? []).map((row) => row.entry_date) });

  // Deliberately a process streak, not a trading streak. Rewarding days traded
  // would push people to trade for the badge, which is the opposite of what a
  // journal is for.
  const followed = (history ?? []).filter((row) => row.followed_rules === true).length;
  const answered = (history ?? []).filter((row) => row.followed_rules !== null).length;
  const rated = (history ?? []).filter((row) => row.discipline !== null);
  const avgDiscipline =
    rated.length === 0
      ? null
      : rated.reduce((sum, row) => sum + (row.discipline ?? 0), 0) / rated.length;

  const shift = (days: number) => {
    const target = new Date(`${date}T12:00:00`);
    target.setDate(target.getDate() + days);
    return `/reflect?date=${isoDate(target)}`;
  };

  const heading = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reflect</h1>
        <p className="mt-1 max-w-lg text-sm text-fg-muted">
          One entry a day. The streak counts days you wrote something — not days
          you traded.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 sm:grid-cols-4">
        <div>
          <p className="flex items-center gap-1.5 text-2xs tracking-wide text-fg-subtle uppercase">
            <Flame aria-hidden className={cn('size-3', streak.current > 0 && 'text-brass')} />
            Current streak
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tnum">
            {streak.current} {streak.current === 1 ? 'day' : 'days'}
          </p>
        </div>
        <div>
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">Longest</p>
          <p className="mt-1 font-mono text-lg font-semibold tnum">{streak.longest}</p>
        </div>
        <div>
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">Rules followed</p>
          <p className="mt-1 font-mono text-lg font-semibold tnum">
            {answered === 0 ? '—' : `${followed}/${answered}`}
          </p>
        </div>
        <div>
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">Avg discipline</p>
          <p className="mt-1 font-mono text-lg font-semibold tnum">
            {avgDiscipline === null ? '—' : avgDiscipline.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={shift(-1)} aria-label="Previous day">
          <Button variant="ghost" size="icon">
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
        </Link>
        <div className="text-center">
          <h2 className="font-display text-lg font-semibold">{heading}</h2>
          {date !== today ? (
            <Link href="/reflect" className="text-xs text-iris-400 hover:text-iris-300">
              Back to today
            </Link>
          ) : null}
        </div>
        <Link
          href={shift(1)}
          aria-label="Next day"
          className={cn(date >= today && 'pointer-events-none opacity-30')}
        >
          <Button variant="ghost" size="icon">
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </Link>
      </div>

      <ReflectionForm date={date} entry={record} />
    </div>
  );
}
