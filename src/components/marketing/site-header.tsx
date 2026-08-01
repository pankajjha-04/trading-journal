'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/product', label: 'How it reads' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span aria-hidden className="size-2 rounded-full bg-iris-500" />
          Ledgerline
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-iris-500 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-iris-400"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-md text-fg-muted md:hidden"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3" aria-label="Main">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-md px-3 py-2 text-center text-sm ring-1 ring-line ring-inset"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-md bg-iris-500 px-3 py-2 text-center text-sm font-medium text-white"
              >
                Start free
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
