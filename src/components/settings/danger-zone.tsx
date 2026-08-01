'use client';

import { useActionState, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { deleteEverything } from '@/app/settings/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';

/**
 * Two gates: a click to reveal, then the exact email typed out. Deleting
 * takes every trade with it and there is no undo, so it should be harder
 * than any other action in the product.
 */
export function DangerZone({ email }: { email: string }) {
  const [state, formAction] = useActionState(deleteEverything, {} as ActionState);
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-loss/30 bg-surface p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-loss" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Delete your account</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            Removes your profile, every account, and every trade. This cannot be
            undone, and support cannot restore it. Export your data first if you
            might want it.
          </p>

          {!open ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setOpen(true)}
            >
              I want to delete my account
            </Button>
          ) : (
            <form action={formAction} className="mt-4 space-y-3" noValidate>
              {state.error ? <FormAlert tone="error" message={state.error} /> : null}

              <Input
                label={`Type ${email} to confirm`}
                name="confirmation"
                autoComplete="off"
                placeholder={email}
                required
              />

              <div className="flex gap-2">
                <SubmitButton variant="danger">Delete everything</SubmitButton>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
