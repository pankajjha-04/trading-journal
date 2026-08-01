'use client';

import { useActionState } from 'react';
import { saveReflection } from '@/app/reflect/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

export interface ReflectionRecord {
  entryDate: string;
  preMarket: string | null;
  reflection: string | null;
  mood: number | null;
  discipline: number | null;
  followedRules: boolean | null;
  meditated: boolean;
}

const SCALE = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function ReflectionForm({
  date,
  entry,
}: {
  date: string;
  entry: ReflectionRecord | null;
}) {
  const [state, formAction] = useActionState(saveReflection, {} as ActionState);
  const keep = state.values ?? {};

  return (
    <form key={state.stamp} action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="entryDate" value={date} />

      {state.error ? <FormAlert tone="error" message={state.error} /> : null}
      {state.success ? <FormAlert tone="success" message={state.success} /> : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Before the session</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          What you expect, and what would make you sit out. Written before the
          first trade, this is the only honest record of your plan.
        </p>
        <div className="mt-4">
          <Textarea
            label="Pre-market notes"
            name="preMarket"
            rows={4}
            placeholder="Levels I care about, what I will not trade, how I slept"
            defaultValue={keep.preMarket ?? entry?.preMarket ?? ''}
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">After the session</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          Rate the day you had, not the money you made.
        </p>

        <div className="mt-4 space-y-4">
          <Textarea
            label="Reflection"
            name="reflection"
            rows={5}
            placeholder="What went to plan, what did not, and what you would repeat"
            defaultValue={keep.reflection ?? entry?.reflection ?? ''}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Mood (1-10)"
              name="mood"
              defaultValue={keep.mood ?? (entry?.mood ? String(entry.mood) : '')}
              options={[{ value: '', label: 'Not recorded' }, ...SCALE]}
            />
            <Select
              label="Discipline (1-10)"
              name="discipline"
              defaultValue={keep.discipline ?? (entry?.discipline ? String(entry.discipline) : '')}
              options={[{ value: '', label: 'Not recorded' }, ...SCALE]}
              hint="How closely you followed your own rules."
            />
            <Select
              label="Followed your rules?"
              name="followedRules"
              defaultValue={
                keep.followedRules ??
                (entry?.followedRules === null || entry?.followedRules === undefined
                  ? 'unknown'
                  : entry.followedRules
                    ? 'yes'
                    : 'no')
              }
              options={[
                { value: 'unknown', label: 'Not recorded' },
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />
            <label className="flex items-end gap-2 pb-2.5 text-sm">
              <input
                type="checkbox"
                name="meditated"
                defaultChecked={entry?.meditated ?? false}
                className="size-4 accent-iris-500"
              />
              <span className="text-fg-muted">Took time to reset before trading</span>
            </label>
          </div>
        </div>
      </section>

      <SubmitButton size="lg">Save the day</SubmitButton>
    </form>
  );
}
