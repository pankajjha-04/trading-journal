export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

/**
 * Hand-rolled rather than pulling in a parser, because the requirements are
 * narrow and the edge cases are the whole job: quoted fields containing the
 * delimiter, escaped quotes, and CRLF line endings from Windows exports.
 */
export function parseCsv(text: string, forcedDelimiter?: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, ''); // Excel writes a BOM
  const delimiter = forcedDelimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Swallow the \n of a \r\n pair rather than emitting an empty row.
      if (char === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows, delimiter };
}

/** Picks whichever candidate appears most consistently across the first lines. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (sample.length === 0) return ',';

  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = -1;

  for (const candidate of candidates) {
    const counts = sample.map((line) => line.split(candidate).length - 1);
    const min = Math.min(...counts);
    if (min === 0) continue;
    // Consistency matters more than raw count: a semicolon file may contain
    // commas inside decimal numbers on every line.
    const consistent = counts.every((c) => c === counts[0]);
    const score = min * (consistent ? 10 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/** Loose header matching so "Entry Price", "entry_price" and "ENTRYPRICE" all hit. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}
