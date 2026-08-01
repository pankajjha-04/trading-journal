'use client';

import { useActionState } from 'react';
import { changePassword } from '@/app/settings/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, {} as ActionState);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Change password</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Your current password is required, so a borrowed session cannot lock you out.
      </p>

      <form action={formAction} className="mt-5 max-w-sm space-y-4" noValidate>
        {state.error ? <FormAlert tone="error" message={state.error} /> : null}
        {state.success ? <FormAlert tone="success" message={state.success} /> : null}

        <PasswordInput
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          error={state.fieldErrors?.currentPassword}
          required
        />
        <PasswordInput
          label="New password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          error={state.fieldErrors?.password}
          required
        />
        <PasswordInput
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
          required
        />

        <SubmitButton>Change password</SubmitButton>
      </form>
    </section>
  );
}
