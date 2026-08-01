'use client';

import { useActionState } from 'react';
import { resetPassword, type ActionState } from '../actions';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

const INITIAL: ActionState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, INITIAL);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <FormAlert tone="error" message={state.error} /> : null}

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
        placeholder="Type it again"
        error={state.fieldErrors?.confirmPassword}
        required
      />

      <SubmitButton size="lg" className="w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
