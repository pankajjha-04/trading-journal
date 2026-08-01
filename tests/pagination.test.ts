import { describe, expect, it } from 'vitest';
import { paginationRange } from '@/lib/utils/pagination';

describe('paginationRange', () => {
  it('lists every page when they all fit', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gaps only on the right near the start', () => {
    expect(paginationRange(2, 14)).toEqual([1, 2, 3, 4, 5, 'gap', 14]);
  });

  it('gaps only on the left near the end', () => {
    expect(paginationRange(13, 14)).toEqual([1, 'gap', 10, 11, 12, 13, 14]);
  });

  it('gaps on both sides in the middle', () => {
    expect(paginationRange(7, 14)).toEqual([1, 'gap', 6, 7, 8, 'gap', 14]);
  });

  it('keeps a constant width so buttons do not move as you page', () => {
    const widths = [1, 2, 3, 7, 10, 13, 14].map((p) => paginationRange(p, 14).length);
    expect(new Set(widths).size).toBe(1);
  });

  it('always includes the first and last page', () => {
    for (const page of [1, 5, 9, 14]) {
      const range = paginationRange(page, 14);
      expect(range[0]).toBe(1);
      expect(range[range.length - 1]).toBe(14);
    }
  });

  it('always includes the current page', () => {
    for (let page = 1; page <= 14; page += 1) {
      expect(paginationRange(page, 14)).toContain(page);
    }
  });

  it('clamps a page number outside the range instead of breaking', () => {
    expect(paginationRange(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(99, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles a single page and an empty set', () => {
    expect(paginationRange(1, 1)).toEqual([1]);
    expect(paginationRange(1, 0)).toEqual([]);
  });
});
