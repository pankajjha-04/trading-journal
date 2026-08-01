import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const ROWS: [string, boolean, boolean][] = [
  ['Costs deducted before R is calculated', false, true],
  ['Expectancy and profit factor without writing formulas', false, true],
  ['Broker CSV imported without retyping', false, true],
  ['Re-importing the same file cannot duplicate trades', false, true],
  ['Performance split by setup, session and weekday', false, true],
  ['Groups too small to trust are flagged', false, true],
  ['Drawdown measured peak to trough, not first to last', false, true],
  ['Works on your phone at the desk', false, true],
  ['Costs nothing to start', true, true],
  ['Your data stays yours, exportable any time', true, true],
];

/**
 * The real competitor is not another journal — it is the spreadsheet the
 * visitor already half-maintains. Naming it directly is more persuasive than
 * comparing against products they have never heard of.
 */
export function VsSpreadsheet() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">Honest comparison</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-balance">
        You already have a spreadsheet. Here is what it does not do.
      </h2>
      <p className="mt-4 max-w-xl text-fg-muted">
        A spreadsheet is fine for recording trades. It is the analysis that
        quietly never gets built.
      </p>

      <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-muted">
              <th scope="col" className="px-5 py-3 font-medium">&nbsp;</th>
              <th scope="col" className="w-28 px-3 py-3 text-center font-medium">
                Spreadsheet
              </th>
              <th scope="col" className="w-28 px-3 py-3 text-center font-medium text-fg">
                Ledgerline
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map(([label, sheet, us]) => (
              <tr key={label}>
                <td className="px-5 py-2.5 text-fg-muted">{label}</td>
                {[sheet, us].map((value, i) => (
                  <td key={i} className="px-3 py-2.5 text-center">
                    {value ? (
                      <Check
                        aria-label="Yes"
                        className={cn(
                          'mx-auto size-4',
                          i === 1 ? 'text-gain' : 'text-fg-subtle',
                        )}
                      />
                    ) : (
                      <Minus aria-label="No" className="mx-auto size-4 text-fg-subtle/50" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-fg-subtle">
        You can build most of this in a spreadsheet. The question is whether you
        will, and whether you will keep it correct for a year.
      </p>
    </section>
  );
}
