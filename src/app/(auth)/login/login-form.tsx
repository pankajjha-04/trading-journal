'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { login, type ActionState } from '../actions';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';
import { GoogleButton } from '@/components/auth/google-button';

const INITIAL: ActionState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(login, INITIAL);

  const keep = state.values ?? {};

  return (
    <div className="space-y-6">
      <GoogleButton next={next} label="Continue with Google" />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-2xs tracking-wide text-fg-subtle uppercase">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form key={state.stamp} action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {state.error ? <FormAlert tone="error" message={state.error} /> : null}

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

        <div>
          <PasswordInput
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            error={state.fieldErrors?.password}
            required
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-fg-muted hover:text-fg"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <SubmitButton size="lg" className="w-full">
          Log in
        </SubmitButton>
      </form>
    </div>
  );
}
