'use client';

import { useActionState } from 'react';
import { Mail } from 'lucide-react';
import { requestPasswordReset, type ActionState } from '../actions';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

const INITIAL: ActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, INITIAL);

  if (state.success) {
    return <FormAlert tone="success" message={state.success} />;
  }

  return (
    <form key={state.stamp} action={formAction} className="space-y-4" noValidate>
      {state.error ? <FormAlert tone="error" message={state.error} /> : null}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.values?.email}
        leadingIcon={<Mail className="size-4" />}
        error={state.fieldErrors?.email}
        required
      />

      <SubmitButton size="lg" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
