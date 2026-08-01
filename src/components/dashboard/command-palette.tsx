'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Command {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: typeof Search;
  keywords: string;
}

const COMMANDS: Command[] = [
  { id: 'new-trade', label: 'Log a trade', hint: 'Journal', href: '/journal/new', icon: Plus, keywords: 'add new entry record' },
  { id: 'import', label: 'Import trades', hint: 'Journal', href: '/journal/import', icon: Upload, keywords: 'csv upload broker binance mt5 orders' },
  { id: 'coach', label: 'Ask the AI coach', hint: 'AI', href: '/coach', icon: Sparkles, keywords: 'review analyse screenshot chart habit' },
  { id: 'overview', label: 'Overview', hint: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: 'home stats balance' },
  { id: 'journal', label: 'Journal', hint: 'Trades', href: '/journal', icon: BookOpen, keywords: 'trades list table history' },
  { id: 'analytics', label: 'Analytics', hint: 'Reports', href: '/analytics', icon: BarChart3, keywords: 'equity curve setup breakdown distribution' },
  { id: 'calendar', label: 'Calendar', hint: 'Days', href: '/calendar', icon: CalendarDays, keywords: 'month days pnl green red' },
  { id: 'reflect', label: 'Reflect', hint: 'Journal', href: '/reflect', icon: NotebookPen, keywords: 'diary notes mood discipline streak psychology' },
  { id: 'goals', label: 'Goals', hint: 'Targets', href: '/goals', icon: Target, keywords: 'target risk limit discipline' },
  { id: 'tools', label: 'Calculators', hint: 'Tools', href: '/tools', icon: Calculator, keywords: 'position size pip reward risk lot' },
  { id: 'reports', label: 'Reports and export', hint: 'Reports', href: '/reports', icon: FileText, keywords: 'export csv excel pdf print backup' },
  { id: 'strategies', label: 'Strategies', hint: 'Settings', href: '/settings/strategies', icon: Settings, keywords: 'rules setup playbook' },
  { id: 'accounts', label: 'Accounts', hint: 'Settings', href: '/settings/accounts', icon: Settings, keywords: 'broker balance archive delete' },
  { id: 'settings', label: 'Settings', hint: 'Account', href: '/settings', icon: Settings, keywords: 'profile theme timezone password' },
];

/**
 * Fuzzy enough to be forgiving, strict enough to rank. A subsequence match
 * means "pos siz" finds "Position size", which is how people actually type
 * when they are in a hurry.
 */
function score(command: Command, query: string): number {
  if (!query) return 1;
  const haystack = `${command.label} ${command.hint} ${command.keywords}`.toLowerCase();
  const needle = query.toLowerCase().trim();

  if (haystack.includes(needle)) return 100 - haystack.indexOf(needle);

  let index = 0;
  for (const char of needle) {
    index = haystack.indexOf(char, index);
    if (index === -1) return 0;
    index += 1;
  }
  return 1;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    return COMMANDS.map((command) => ({ command, weight: score(command, query) }))
      .filter((entry) => entry.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .map((entry) => entry.command);
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery('');
        setActive(0);
      }
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-e3"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                go(results[active]);
              }
            }}
            placeholder="Jump to anything…"
            aria-label="Search commands"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-fg-subtle">
            esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-fg-subtle">Nothing matches that.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1.5">
            {results.map((command, index) => {
              const Icon = command.icon;
              return (
                <li key={command.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(command)}
                    aria-selected={index === active}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      index === active ? 'bg-surface-2 text-fg' : 'text-fg-muted',
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                    <span className="flex-1">{command.label}</span>
                    <span className="text-2xs text-fg-subtle">{command.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
