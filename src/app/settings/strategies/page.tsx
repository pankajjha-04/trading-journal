import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StrategyManager, type StrategyRecord } from '@/components/settings/strategy-manager';

export const metadata: Metadata = {
  title: 'Strategies',
  robots: { index: false, follow: false },
};

export default async function StrategiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: strategies }, { data: trades }] = await Promise.all([
    supabase
      .from('strategies')
      .select('id, name, description, color, rules, is_favorite')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true }),
    supabase.from('trades').select('strategy_id').eq('user_id', user.id),
  ]);

  const counts = new Map<string, number>();
  for (const trade of trades ?? []) {
    if (!trade.strategy_id) continue;
    counts.set(trade.strategy_id, (counts.get(trade.strategy_id) ?? 0) + 1);
  }

  const records: StrategyRecord[] = (strategies ?? []).map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    color: strategy.color,
    rules: Array.isArray(strategy.rules) ? (strategy.rules as string[]) : [],
    isFavorite: strategy.is_favorite,
    tradeCount: counts.get(strategy.id) ?? 0,
  }));

  return <StrategyManager strategies={records} />;
}
