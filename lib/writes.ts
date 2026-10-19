import 'server-only';
import { batchGet, updateValues } from './google.ts';

// Every write re-reads the cell first. If someone changed it in the sheet since the
// page loaded, nothing is written and the caller gets both values to choose from.

export type WriteResult =
  | { ok: true }
  | { ok: false; conflict: { current: string; attempted: string } }
  | { ok: false; error: string };

export async function safeWrite(spreadsheetId: string, range: string, expected: string, value: string): Promise<WriteResult> {
  if (value.trim().startsWith('=')) return { ok: false, error: 'Formulas can’t be written from the app.' };
  const [[shown], [formula]] = await Promise.all([
    batchGet(spreadsheetId, [range], 'FORMATTED_VALUE'),
    batchGet(spreadsheetId, [range], 'FORMULA'),
  ]);
  const current = (shown?.[0]?.[0] ?? '').toString();
  const raw = (formula?.[0]?.[0] ?? '').toString();
  if (raw.startsWith('=')) return { ok: false, error: 'This cell is a formula. Change it in the sheet.' };
  if (current.trim() !== expected.trim()) return { ok: false, conflict: { current, attempted: value } };
  if (current.trim() === value.trim()) return { ok: true };
  await updateValues(spreadsheetId, range, [[value]]);
  return { ok: true };
}
