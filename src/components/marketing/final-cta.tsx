import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="glass rounded-2xl px-8 py-14 text-center sm:px-12">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-semibold text-balance">
          You have already made the trades. This just tells you what they meant.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-fg-muted">
          Import the last three months tonight and you will know by tomorrow
          which setup has been carrying you — and which one has been eating it.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-iris-500 px-7 text-sm font-medium text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-iris-400"
        >
          Create your free account
          <ArrowRight aria-hidden className="size-4" />
        </Link>

        <p className="mt-4 text-xs text-fg-subtle">
          Free for 50 trades · No card · Export everything, any time
        </p>
      </div>
    </section>
  );
}
