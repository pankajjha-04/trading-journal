'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe handle on a server error — the message
    // itself is stripped in production and must never be shown to a user.
    console.error('Unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<AlertTriangle className="size-5" />}
          title="Something broke on our side"
          description="The page could not finish loading. Trying again usually works — the issue has been logged either way."
          action={<Button onClick={reset}>Try again</Button>}
        />
      </div>
    </main>
  );
}
