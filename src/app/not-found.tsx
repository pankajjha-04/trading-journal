import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Compass className="size-5" />}
          title="That page does not exist"
          description="The link may be out of date, or the page may have moved."
          action={
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          }
        />
      </div>
    </main>
  );
}
