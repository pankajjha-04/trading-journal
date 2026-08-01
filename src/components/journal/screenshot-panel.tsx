'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deleteScreenshot, recordScreenshot } from '@/app/journal/screenshot-actions';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';

export interface StoredShot {
  id: string;
  url: string;
  caption: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export function ScreenshotPanel({
  tradeId,
  shots,
}: {
  tradeId: string;
  shots: StoredShot[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<StoredShot | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | null | undefined) {
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      setError('Upload a PNG, JPEG or WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That image is over 10 MB.');
      return;
    }

    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Your session expired. Reload the page.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    // The first path segment is the owner — that is the whole storage policy.
    const path = `${user.id}/${tradeId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setError('That upload failed. Try again.');
      return;
    }

    startTransition(async () => {
      const result = await recordScreenshot({ tradeId, storagePath: path });
      if (result.error) setError(result.error);
      if (input.current) input.current.value = '';
    });
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Screenshots</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        The chart as it looked when you took the trade. Six months later this is
        the only thing that reminds you what you actually saw.
      </p>

      {error ? <div className="mt-4"><FormAlert tone="error" message={error} /></div> : null}

      {shots.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shots.map((shot) => (
            <li key={shot.id} className="group relative overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setPreview(shot)}
                className="block w-full"
                aria-label="View full size"
              >
                <Image
                  src={shot.url}
                  alt={shot.caption ?? 'Trade screenshot'}
                  width={400}
                  height={260}
                  className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
              </button>
              <button
                type="button"
                onClick={() => startTransition(() => void deleteScreenshot(shot.id))}
                disabled={pending}
                aria-label="Delete screenshot"
                className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white/80 opacity-0 backdrop-blur transition-opacity hover:text-loss focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files?.[0]);
        }}
        onPaste={(e) => {
          const item = [...e.clipboardData.items].find((i) => i.kind === 'file');
          if (item) void upload(item.getAsFile());
        }}
        className={cn(
          'mt-4 flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-6 py-6 text-center transition-colors',
          dragging ? 'border-iris-500 bg-surface-2' : 'border-line hover:border-line-strong hover:bg-surface-2',
        )}
      >
        <ImagePlus aria-hidden className="size-5 text-fg-subtle" />
        <span className="text-sm font-medium">
          {pending ? 'Attaching…' : 'Paste, drop or choose an image'}
        </span>
        <span className="text-2xs text-fg-subtle">PNG, JPEG or WebP · up to 10 MB</span>
        <input
          ref={input}
          type="file"
          accept={ALLOWED.join(',')}
          className="sr-only"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          >
            <X aria-hidden className="size-5" />
          </Button>
          <Image
            src={preview.url}
            alt={preview.caption ?? 'Trade screenshot'}
            width={1600}
            height={1000}
            className="max-h-full w-auto rounded-lg object-contain"
            unoptimized
          />
        </div>
      ) : null}
    </section>
  );
}
