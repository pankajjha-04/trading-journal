'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Appears only after the hero has scrolled past, so the call to action is
 * still reachable four screens down without following the visitor from the
 * first pixel. Hidden on large screens, where the header CTA is always visible.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cnVisible(visible)}
      // Hidden from assistive tech while off-screen so it is not announced twice.
      aria-hidden={!visible}
    >
      <div className="glass flex items-center gap-3 rounded-full py-2 pr-2 pl-5 shadow-e3">
        <p className="text-xs text-fg-muted">Free for 50 trades</p>
        <Link
          href="/signup"
          tabIndex={visible ? 0 : -1}
          className="rounded-full bg-iris-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-iris-400"
        >
          Start free
        </Link>
      </div>
    </div>
  );
}

function cnVisible(visible: boolean): string {
  return [
    'fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit justify-center px-4 lg:hidden',
    'transition-all duration-300 ease-[var(--ease-out-quint)] motion-reduce:transition-none',
    visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
  ].join(' ');
}
