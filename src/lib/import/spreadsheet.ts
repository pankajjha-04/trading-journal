import { parseCsv } from './csv';

/** Enough rows for the model to see the shape without burning the budget. */
const MAX_ROWS = 200;
const MAX_CHARS = 20_000;

export interface SheetExtract {
  text: string;
  rowCount: number;
  truncated: boolean;
  sheetNames: string[];
}

function tabulate(rows: string[][], headers: string[]): SheetExtract {
  const kept = rows.slice(0, MAX_ROWS);
  const lines = [headers.join(' | '), ...kept.map((row) => row.join(' | '))];

  let text = lines.join('\n');
  let truncated = rows.length > kept.length;

  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    truncated = true;
  }

  return { text, rowCount: rows.length, truncated, sheetNames: [] };
}

/**
 * Spreadsheets are read in the browser and sent as text. An .xlsx is a zip of
 * XML — no model can read the bytes, and uploading it raw would waste the
 * whole token budget on base64 that decodes to nothing useful.
 */
export async function extractSpreadsheet(file: File): Promise<SheetExtract> {
  const isCsv =
    file.type === 'text/csv' ||
    file.name.toLowerCase().endsWith('.csv') ||
    file.name.toLowerCase().endsWith('.tsv');

  if (isCsv) {
    const { headers, rows } = parseCsv(await file.text());
    return tabulate(rows, headers);
  }

  // Loaded on demand: SheetJS is large and most sessions never open a
  // spreadsheet, so it must not sit in the page's initial bundle.
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const sheetNames = workbook.SheetNames;
  const first = sheetNames[0];
  if (!first) throw new Error('That workbook has no sheets.');

  const sheet = workbook.Sheets[first];
  if (!sheet) throw new Error('That sheet could not be read.');

  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const [headerRow = [], ...body] = grid;
  const extract = tabulate(
    body.map((row) => row.map((cell) => String(cell ?? ''))),
    headerRow.map((cell) => String(cell ?? '')),
  );

  return { ...extract, sheetNames };
}

export function isSpreadsheet(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type === 'text/csv'
  );
}
