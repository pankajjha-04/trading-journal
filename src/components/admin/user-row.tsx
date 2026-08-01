'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { setUserPlan, setUserRole } from '@/app/admin/actions';
import { cn } from '@/lib/utils/cn';

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  planId: string | null;
  planName: string;
  status: string | null;
  trades: number;
  joined: string;
}

export function UserRow({
  user,
  plans,
}: {
  user: AdminUserRecord;
  plans: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const select =
    'h-8 rounded-md bg-surface-2 px-2 text-xs ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500 disabled:opacity-50';

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <p className="truncate text-sm font-medium">{user.fullName ?? '—'}</p>
        <p className="truncate text-2xs text-fg-subtle">{user.email}</p>
        {message ? <p className="mt-0.5 text-2xs text-iris-400">{message}</p> : null}
      </td>

      <td className="px-4 py-3 font-mono text-xs text-fg-muted tnum">
        {user.trades.toLocaleString()}
      </td>

      <td className="px-4 py-3 text-xs text-fg-muted">
        {new Date(user.joined).toLocaleDateString()}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <select
            value={user.planId ?? ''}
            disabled={pending}
            aria-label={`Plan for ${user.email}`}
            onChange={(event) => {
              const next = event.target.value || null;
              startTransition(async () => {
                const result = await setUserPlan(user.id, next);
                setMessage(result.error ?? result.success ?? null);
              });
            }}
            className={select}
          >
            <option value="">Free</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          {user.status === 'active' ? (
            <Check aria-hidden className="size-3.5 text-gain" />
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3">
        <select
          value={user.role}
          disabled={pending}
          aria-label={`Role for ${user.email}`}
          onChange={(event) => {
            const next = event.target.value as 'user' | 'support' | 'admin';
            startTransition(async () => {
              const result = await setUserRole(user.id, next);
              setMessage(result.error ?? result.success ?? null);
            });
          }}
          className={cn(select, user.role === 'admin' && 'text-brass')}
        >
          <option value="user">User</option>
          <option value="support">Support</option>
          <option value="admin">Admin</option>
        </select>
      </td>

      <td className="px-2 py-3">
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-fg-subtle" /> : null}
      </td>
    </tr>
  );
}
