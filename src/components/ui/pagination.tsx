import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationRange } from '@/lib/utils/pagination';
import { cn } from '@/lib/utils/cn';

/**
 * Real links, not buttons: middle-click opens a page in a new tab, the back
 * button works, and a page of results can be shared.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  query,
  label = 'Pagination',
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query: URLSearchParams;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(query);
    if (target === 1) next.delete('page');
    else next.set('page', String(target));
    const search = next.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const base =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-xs transition-colors';

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label={label}>
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          aria-label="Previous page"
          className={cn(base, 'text-fg-muted ring-1 ring-line ring-inset hover:bg-surface-2 hover:text-fg')}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(base, 'text-fg-subtle/40 ring-1 ring-line ring-inset')}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {paginationRange(page, totalPages).map((item, i) =>
        item === 'gap' ? (
          <span
            key={`gap-${i}`}
            aria-hidden
            className="inline-flex h-9 w-6 items-center justify-center text-xs text-fg-subtle"
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              base,
              'font-mono tnum',
              item === page
                ? 'bg-iris-500 font-semibold text-white ring-1 ring-white/10 ring-inset'
                : 'text-fg-muted ring-1 ring-line ring-inset hover:bg-surface-2 hover:text-fg',
            )}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          rel="next"
          aria-label="Next page"
          className={cn(base, 'text-fg-muted ring-1 ring-line ring-inset hover:bg-surface-2 hover:text-fg')}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(base, 'text-fg-subtle/40 ring-1 ring-line ring-inset')}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
