export type PageItem = number | 'gap';

/**
 * Which page numbers to show, with gaps standing in for the rest.
 *
 * The window is a fixed width so the control does not resize as you page
 * through — buttons that move under the cursor are how people click the
 * wrong page.
 */
export function paginationRange(
  current: number,
  total: number,
  siblings = 1,
): PageItem[] {
  const page = Math.min(Math.max(1, current), Math.max(1, total));

  // first + last + current + two gaps + siblings on each side
  const slots = siblings * 2 + 5;
  if (total <= slots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, total);
  const showLeftGap = left > 2;
  const showRightGap = right < total - 1;

  // Near an edge, spend the freed slots widening the run on that side rather
  // than leaving a stubby control.
  if (!showLeftGap && showRightGap) {
    const count = 3 + siblings * 2;
    return [...Array.from({ length: count }, (_, i) => i + 1), 'gap', total];
  }

  if (showLeftGap && !showRightGap) {
    const count = 3 + siblings * 2;
    return [
      1,
      'gap',
      ...Array.from({ length: count }, (_, i) => total - count + 1 + i),
    ];
  }

  return [
    1,
    'gap',
    ...Array.from({ length: right - left + 1 }, (_, i) => left + i),
    'gap',
    total,
  ];
}
