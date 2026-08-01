import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#features', label: 'Features' },
      { href: '/product', label: 'How it reads' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/signup', label: 'Create an account' },
      { href: '/login', label: 'Log in' },
      { href: '/forgot-password', label: 'Reset password' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex w-fit items-center gap-2 text-sm font-semibold">
              <span aria-hidden className="size-2 rounded-full bg-iris-500" />
              Ledgerline
            </Link>
            <p className="mt-3 max-w-xs text-sm text-fg-muted">
              A trading journal that tells you which setups pay, and which ones
              only look like they do.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-2xs tracking-wide text-fg-subtle uppercase">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-fg-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <p className="text-2xs text-fg-subtle">
            © {new Date().getFullYear()} Ledgerline. Your trade data stays yours.
          </p>
          <p className="max-w-lg text-2xs text-fg-subtle">
            Ledgerline records and analyses trades you have already made. It does
            not give trading advice, signals, or recommendations.
          </p>
        </div>
      </div>
    </footer>
  );
}
