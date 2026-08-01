import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/guard';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Admin · Payments',
  robots: { index: false, follow: false },
};

const TONE: Record<string, string> = {
  paid: 'bg-gain-soft text-gain',
  pending: 'bg-surface-3 text-fg-muted',
  failed: 'bg-loss-soft text-loss',
  refunded: 'bg-surface-3 text-fg-subtle',
};

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export default async function AdminPayments() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: payments }, { data: invoices }] = await Promise.all([
    admin
      .from('payments')
      .select('id, user_id, plan_id, provider, status, amount_minor, currency, created_at, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('invoices')
      .select('id, number, issued_on, total_minor, tax_minor, currency')
      .order('issued_on', { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">
          Recent payments
        </h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">When</th>
              <th scope="col" className="px-4 py-2.5 font-medium">User</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Plan</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Method</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!payments || payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-fg-subtle">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const email = (payment as unknown as { profiles?: { email: string } }).profiles?.email;
                return (
                  <tr key={payment.id}>
                    <td className="px-4 py-2.5 text-xs text-fg-muted">
                      {new Date(payment.created_at).toLocaleString()}
                    </td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-xs">{email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs">{payment.plan_id}</td>
                    <td className="px-4 py-2.5 text-xs capitalize">{payment.provider}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-2xs font-medium',
                          TONE[payment.status] ?? 'bg-surface-3 text-fg-muted',
                        )}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm tnum">
                      {money(payment.amount_minor, payment.currency)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {invoices && invoices.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Invoices</h2>
          <ul className="divide-y divide-line">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <div>
                  <p className="font-mono text-xs tnum">{invoice.number}</p>
                  <p className="text-2xs text-fg-subtle">
                    {new Date(invoice.issued_on).toLocaleDateString()} · tax{' '}
                    {money(invoice.tax_minor, invoice.currency)}
                  </p>
                </div>
                <span className="font-mono text-sm tnum">
                  {money(invoice.total_minor, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
