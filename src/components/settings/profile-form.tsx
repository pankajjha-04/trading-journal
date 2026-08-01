'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateProfile } from '@/app/settings/actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SubmitButton } from '@/components/auth/submit-button';
import { FormAlert } from '@/components/auth/form-alert';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'JPY'].map((c) => ({
  value: c,
  label: c,
}));

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match my system' },
];

export function ProfileForm({
  email,
  fullName,
  timezone,
  baseCurrency,
  theme,
  timezones,
}: {
  email: string;
  fullName: string;
  timezone: string;
  baseCurrency: string;
  theme: string;
  timezones: string[];
}) {
  const [state, formAction] = useActionState(updateProfile, {} as ActionState);
  const [selectedTheme, setSelectedTheme] = useState(theme);

  // Applied immediately so the choice is visible before the form is saved —
  // a theme picker that waits for a round trip feels broken.
  useEffect(() => {
    const resolved =
      selectedTheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : selectedTheme;

    document.documentElement.setAttribute('data-theme', resolved);
    try {
      localStorage.setItem('theme', selectedTheme);
    } catch {
      // Private browsing can block storage; the server copy still persists.
    }
  }, [selectedTheme]);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Profile</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Timezone decides which day and session a trade belongs to.
      </p>

      <form action={formAction} className="mt-5 space-y-4" noValidate>
        {state.error ? <FormAlert tone="error" message={state.error} /> : null}
        {state.success ? <FormAlert tone="success" message={state.success} /> : null}

        <Input
          label="Name"
          name="fullName"
          defaultValue={fullName}
          error={state.fieldErrors?.fullName}
          required
        />

        <Input
          label="Email"
          value={email}
          readOnly
          disabled
          hint="Changing your email is not supported yet."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Timezone"
            name="timezone"
            defaultValue={timezone}
            options={timezones.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
            error={state.fieldErrors?.timezone}
          />
          <Select
            label="Base currency"
            name="baseCurrency"
            defaultValue={baseCurrency}
            options={CURRENCIES}
            hint="Used where no account is selected."
            error={state.fieldErrors?.baseCurrency}
          />
        </div>

        <Select
          label="Theme"
          name="theme"
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
          options={THEMES}
        />

        <SubmitButton>Save changes</SubmitButton>
      </form>
    </section>
  );
}
