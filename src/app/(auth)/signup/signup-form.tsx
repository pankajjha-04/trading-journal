'use client';

import { useActionState } from 'react';
import { Mail, User } from 'lucide-react';
import { signup, type ActionState } from '../actions';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import { GoogleButton } from '@/components/auth/google-button';

const INITIAL: ActionState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signup, INITIAL);

  // Once the confirmation mail is sent, the form has nothing left to do —
  // leaving it on screen invites a second, pointless submission.
  if (state.success) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success" message={state.success} />
        <p className="text-sm text-fg-muted">
          The link expires in 24 hours. If it does not arrive within a few minutes,
          check your spam folder.
        </p>
      </div>
    );
  }

  const keep = state.values ?? {};

  return (
    <div className="space-y-6">
      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-2xs tracking-wide text-fg-subtle uppercase">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form key={state.stamp} action={formAction} className="space-y-4" noValidate>
        {state.error ? <FormAlert tone="error" message={state.error} /> : null}

        <Input
          label="Name"
          name="fullName"
          autoComplete="name"
          placeholder="Pankaj Jha"
          defaultValue={keep.fullName}
          leadingIcon={<User className="size-4" />}
          error={state.fieldErrors?.fullName}
          required
        />

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={keep.email}
          leadingIcon={<Mail className="size-4" />}
          error={state.fieldErrors?.email}
          required
        />

        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          hint="Length matters more than symbols. A short phrase works well."
          error={state.fieldErrors?.password}
          required
        />

        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Type it again"
          error={state.fieldErrors?.confirmPassword}
          required
        />

        <SubmitButton size="lg" className="w-full">
          Create account
        </SubmitButton>

        <p className="text-2xs leading-relaxed text-fg-subtle">
          By creating an account you agree to our terms and privacy policy.
        </p>
      </form>
    </div>
  );
}
