'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  BarChart3,
  FileText,
  ImageIcon,
  Layers,
  Lightbulb,
  Paperclip,
  Send,
  Shield,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { PRESETS, type PresetId } from '@/lib/ai/coach';
import { extractSpreadsheet, isSpreadsheet } from '@/lib/import/spreadsheet';
import { askCoach, type CoachState } from '@/app/coach/actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';
import type { AccountSummary } from '@/lib/data/trades';

const ICONS: Record<PresetId, typeof Sparkles> = {
  chart: ImageIcon,
  statement: FileText,
  account: BarChart3,
  habit: Lightbulb,
  drop: Layers,
  risk: Shield,
};

const ACCEPT: Record<string, string> = {
  image: 'image/png,image/jpeg,image/webp',
  document: '.pdf,.csv,.tsv,.xlsx,.xls,application/pdf,text/csv',
};

const MAX_BYTES = 4 * 1024 * 1024;

function prettySize(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** File → base64 without the data-URL prefix, which the APIs reject. */
function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

export function CoachPanel({ accounts }: { accounts: AccountSummary[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [custom, setCustom] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<CoachState | null>(null);
  const [pending, startTransition] = useTransition();
  // Which action is in flight, so the spinner appears on the thing that was
  // clicked rather than on whichever button happens to own the pending flag.
  const [running, setRunning] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const active = PRESETS.find((p) => p.id === preset);
  const needsFile = active?.needs === 'image' || active?.needs === 'document';

  const accept = useCallback((candidate: File | null) => {
    if (!candidate) return;
    if (candidate.size > MAX_BYTES) {
      setState({ error: `That file is ${prettySize(candidate.size)}. The limit is 4 MB.` });
      return;
    }
    setState(null);
    setFile(candidate);
  }, []);

  // A trader crops a chart and hits Ctrl+V. Making them save it to disk first
  // is friction for nothing.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.kind !== 'file') continue;
        const pasted = item.getAsFile();
        if (!pasted) continue;

        if (pasted.type.startsWith('image/')) {
          setPreset('chart');
          accept(new File([pasted], `pasted-${Date.now()}.png`, { type: pasted.type }));
          event.preventDefault();
          return;
        }
        if (pasted.type === 'application/pdf' || isSpreadsheet(pasted)) {
          setPreset('statement');
          accept(pasted);
          event.preventDefault();
          return;
        }
      }
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept]);

  function run(presetId: PresetId | null, question?: string) {
    setRunning(presetId ?? 'custom');
    setState(null);
    startTransition(async () => {
      let attachment: { mediaType: string; data: string } | undefined;
      let sheet:
        | { name: string; text: string; rowCount: number; truncated: boolean }
        | undefined;

      if (file) {
        try {
          if (isSpreadsheet(file)) {
            // Flattened in the browser: an .xlsx is a zip of XML, and no model
            // can read the bytes.
            const extract = await extractSpreadsheet(file);
            sheet = {
              name: file.name,
              text: extract.text,
              rowCount: extract.rowCount,
              truncated: extract.truncated,
            };
          } else {
            attachment = { mediaType: file.type, data: await toBase64(file) };
          }
        } catch {
          setState({ error: 'That file could not be read. Try exporting it again.' });
          setRunning(null);
          return;
        }
      }
      setState(
        await askCoach({
          accountId,
          presetId: presetId ?? '',
          question,
          attachment,
          sheet,
        }),
      );
      setRunning(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Sparkles aria-hidden className="size-5 text-iris-400" />
            AI coach
          </h1>
          <p className="mt-1 max-w-lg text-sm text-fg-muted">
            Pick a question, or paste a chart straight from your clipboard. It
            reads your logged trades either way.
          </p>
        </div>

        {accounts.length > 1 ? (
          <div>
            <label htmlFor="coach-account" className="sr-only">
              Account
            </label>
            <select
              id="coach-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 rounded-md bg-surface-2 px-3 text-xs ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((option) => {
          const Icon = ICONS[option.id];
          const selected = preset === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setPreset(option.id);
                setState(null);
                if (option.needs === 'none') {
                  setFile(null);
                  run(option.id);
                }
              }}
              disabled={pending}
              aria-pressed={selected}
              className={cn(
                'relative flex flex-col items-start gap-2 p-5 text-left transition-colors',
                selected ? 'bg-surface-2' : 'bg-surface hover:bg-surface-2',
                pending && running !== option.id && 'opacity-40',
              )}
            >
              {selected ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-0.5 bg-iris-500"
                />
              ) : null}
              {running === option.id ? (
                <Loader2 aria-hidden className="size-5 animate-spin text-iris-400" />
              ) : (
                <Icon aria-hidden className="size-5 text-iris-400" />
              )}
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-fg-muted">{option.blurb}</span>
              {option.needs !== 'none' ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-2xs text-fg-subtle">
                  <Paperclip aria-hidden className="size-3" />
                  {option.needs === 'document'
                    ? 'PDF, Excel or CSV'
                    : 'paste or upload an image'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {needsFile ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{active?.label}</h2>
          <p className="mt-0.5 text-xs text-fg-muted">{active?.blurb}</p>

          {file ? (
            <div className="mt-4 flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
              <Paperclip aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <span className="min-w-0 flex-1 truncate text-xs">
                {file.name}
                <span className="ml-2 text-fg-subtle">{prettySize(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = '';
                }}
                aria-label="Remove file"
                className="text-fg-subtle hover:text-fg"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                accept(e.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                'mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-9 text-center transition-colors',
                dragging
                  ? 'border-iris-500 bg-surface-2'
                  : 'border-line hover:border-line-strong hover:bg-surface-2',
              )}
            >
              <Paperclip aria-hidden className="size-5 text-fg-subtle" />
              <span className="text-sm font-medium">
                {active?.needs === 'document'
                  ? 'Drop a PDF, Excel or CSV — or click to choose'
                  : 'Paste with Ctrl+V, drop an image, or click to choose'}
              </span>
              <span className="text-2xs text-fg-subtle">Up to 4 MB</span>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT[active?.needs ?? 'image']}
                className="sr-only"
                onChange={(e) => accept(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <Button
            className="mt-4"
            loading={running === preset}
            disabled={pending || !file}
            leadingIcon={<Send className="size-4" />}
            onClick={() => run(preset)}
          >
            Analyse it
          </Button>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Or ask your own</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          About your own history only. It will not predict price or tell you what
          to trade.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.trim()) {
                setPreset(null);
                run(null, custom.trim());
              }
            }}
            placeholder="Why do my Fridays lose money?"
            maxLength={500}
            className="h-10 min-w-48 flex-1 rounded-md bg-surface-2 px-3 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-iris-500"
          />
          <Button
            loading={running === 'custom'}
            disabled={pending || !custom.trim()}
            onClick={() => {
              setPreset(null);
              run(null, custom.trim());
            }}
          >
            Ask
          </Button>
        </div>
      </section>

      {pending ? (
        <section
          className="rounded-xl border border-line bg-surface p-5"
          role="status"
          aria-label="Thinking"
        >
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin text-iris-400" />
            Reading{' '}
            {running === 'custom'
              ? 'your question'
              : (PRESETS.find((p) => p.id === running)?.label.toLowerCase() ?? 'your trades')}
            …
          </p>
          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-3" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-3" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-3" />
          </div>
        </section>
      ) : null}

      {state?.error ? <FormAlert tone="error" message={state.error} /> : null}

      {state?.answer ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm leading-relaxed">{state.answer.summary}</p>

          <div className="mt-5 space-y-4">
            {state.answer.points.map((point, i) => (
              <div key={i} className="border-l-2 border-iris-500/40 pl-4">
                <h3 className="text-sm font-semibold">{point.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{point.detail}</p>
              </div>
            ))}
          </div>

          {state.answer.nextSteps.length > 0 ? (
            <div className="mt-5 rounded-md bg-surface-2 p-4">
              <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                What to do next
              </h3>
              <ul className="mt-2 space-y-1.5">
                {state.answer.nextSteps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-fg-muted">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-iris-400" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-2xs text-fg-subtle">
            {state.cached
              ? 'Saved from an identical earlier question.'
              : 'Based only on your logged trades. Not advice.'}
          </p>
        </section>
      ) : null}
    </div>
  );
}
