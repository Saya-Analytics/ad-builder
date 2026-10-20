import 'server-only';
import { batchGet, batchUpdateValues, updateValues } from './google.ts';

// Every write re-reads the cell first. If someone changed it in the sheet since the
// page loaded, nothing is written and the caller gets both values to choose from.

export type WriteResult =
  | { ok: true }
  | { ok: false; conflict: { current: string; attempted: string } }
  | { ok: false; error: string };

/** Long digit strings (creator post IDs) stay text; otherwise Sheets turns them into 1.79E+16. */
const asText = (v: string) => (/^\d{12,}$/.test(v.trim()) ? `'${v.trim()}` : v);

export async function safeWrite(spreadsheetId: string, range: string, expected: string, value: string): Promise<WriteResult> {
  if (value.trim().startsWith('=')) return { ok: false, error: 'Formulas can’t be written from the app.' };
  const [[shown], [formula]] = await Promise.all([
    batchGet(spreadsheetId, [range], 'FORMATTED_VALUE', true),
    batchGet(spreadsheetId, [range], 'FORMULA', true),
  ]);
  const current = (shown?.[0]?.[0] ?? '').toString();
  const raw = (formula?.[0]?.[0] ?? '').toString();
  if (raw.startsWith('=')) return { ok: false, error: 'This cell is a formula. Change it in the sheet.' };
  if (current.trim() !== expected.trim()) return { ok: false, conflict: { current, attempted: value } };
  if (current.trim() === value.trim()) return { ok: true };
  await updateValues(spreadsheetId, range, [[asText(value)]]);
  return { ok: true };
}

export interface CellEdit {
  range: string;
  expected: string;
  value: string;
}

export type CellResult = { range: string } & WriteResult;

/**
 * Many cells at once with the same guard: two reads (shown values and formulas) and one write,
 * whatever the number of cells, so a big save doesn't use up Google's per-minute quota.
 */
export async function safeWriteMany(spreadsheetId: string, edits: CellEdit[]): Promise<CellResult[]> {
  if (!edits.length) return [];
  const ranges = edits.map((e) => e.range);
  const [shown, formulas] = await Promise.all([
    batchGet(spreadsheetId, ranges, 'FORMATTED_VALUE', true),
    batchGet(spreadsheetId, ranges, 'FORMULA', true),
  ]);
  const results: CellResult[] = [];
  const toWrite: { range: string; values: string[][] }[] = [];
  edits.forEach((e, i) => {
    const current = (shown[i]?.[0]?.[0] ?? '').toString();
    const raw = (formulas[i]?.[0]?.[0] ?? '').toString();
    if (e.value.trim().startsWith('=')) results.push({ range: e.range, ok: false, error: 'Formulas can’t be written from the app.' });
    else if (raw.startsWith('=')) results.push({ range: e.range, ok: false, error: 'This cell is a formula. Change it in the sheet.' });
    else if (current.trim() !== e.expected.trim()) results.push({ range: e.range, ok: false, conflict: { current, attempted: e.value } });
    else {
      if (current.trim() !== e.value.trim()) toWrite.push({ range: e.range, values: [[asText(e.value)]] });
      results.push({ range: e.range, ok: true });
    }
  });
  await batchUpdateValues(spreadsheetId, toWrite);
  return results;
}
