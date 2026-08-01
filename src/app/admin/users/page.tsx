import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/guard';
import { UserRow, type AdminUserRecord } from '@/components/admin/user-row';
import { Pagination } from '@/components/ui/pagination';

export const metadata: Metadata = {
  title: 'Admin · Users',
  robots: { index: false, follow: false },
};

const PER_PAGE = 25;

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const query = (params.q ?? '').trim();

  const admin = createAdminClient();

  let request = admin
    .from('profiles')
    .select('id, email, full_name, role, created_at, subscriptions(status, plan_id, plans(name))', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  if (query) {
    // Stripped so a comma or parenthesis in the search box cannot break out of
    // the filter expression.
    const safe = query.replace(/[,()]/g, '');
    request = request.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`);
  }

  const [{ data: profiles, count }, { data: plans }, { data: tradeRows }] = await Promise.all([
    request,
    admin.from('plans').select('id, name').eq('is_active', true).neq('tier', 'free'),
    admin.from('trades').select('user_id').limit(100_000),
  ]);

  const tradeCounts = new Map<string, number>();
  for (const row of tradeRows ?? []) {
    tradeCounts.set(row.user_id, (tradeCounts.get(row.user_id) ?? 0) + 1);
  }

  const users: AdminUserRecord[] = (profiles ?? []).map((profile) => {
    const sub = (profile as unknown as {
      subscriptions?:
        | { status: string; plan_id: string; plans?: { name: string } }[]
        | { status: string; plan_id: string; plans?: { name: string } }
        | null;
    }).subscriptions;
    const record = Array.isArray(sub) ? sub[0] : sub;

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      planId: record?.plan_id ?? null,
      planName: record?.plans?.name ?? 'Free',
      status: record?.status ?? null,
      trades: tradeCounts.get(profile.id) ?? 0,
      joined: profile.created_at,
    };
  });

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const search = new URLSearchParams(query ? { q: query } : {});

  return (
    <div className="space-y-4">
      <form action="/admin/users" className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by email or name"
            aria-label="Search users"
            className="h-9 w-full rounded-md bg-surface-2 pl-9 pr-3 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
          />
        </div>
        {query ? (
          <Link
            href="/admin/users"
            className="flex h-9 items-center rounded-md px-3 text-xs text-fg-muted ring-1 ring-line ring-inset hover:bg-surface-2"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">User</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Trades</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Plan</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
              <th scope="col" className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-fg-subtle">
                  {query ? 'Nobody matches that.' : 'No users yet.'}
                </td>
              </tr>
            ) : (
              users.map((user) => <UserRow key={user.id} user={user} plans={plans ?? []} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-subtle">
          {total} {total === 1 ? 'user' : 'users'}
        </p>
        <Pagination
          page={page}
          totalPages={pages}
          basePath="/admin/users"
          query={search}
          label="User pages"
        />
      </div>
    </div>
  );
}
