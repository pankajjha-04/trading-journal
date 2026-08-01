'use client';

import { useActionState } from 'react';
import { subscribe } from '@/app/(marketing)/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

export function Newsletter() {
  const [state, formAction] = useActionState(subscribe, {} as ActionState);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="glass rounded-2xl p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold text-balance">
              One email a month, when something ships.
            </h2>
            <p className="mt-2 max-w-md text-sm text-fg-muted">
              Broker integrations, new breakdowns, and the occasional write-up on
              a metric that is more misleading than it looks. No drip sequence.
            </p>
          </div>

          {state.success ? (
            <FormAlert tone="success" message={state.success} />
          ) : (
            <form action={formAction} className="flex items-start gap-2" noValidate>
              <div className="flex-1">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  error={state.fieldErrors?.email}
                  required
                />
              </div>
              <div className="pt-6">
                <SubmitButton>Subscribe</SubmitButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
