'use server';

import { revalidatePath } from 'next/cache';
import { a1, isWritableApprovalCol, TABS } from '@/lib/columns';
import { batchGet, dropdownOptions, getMeta } from '@/lib/google';
import { loadClientState } from '@/lib/data';
import { driveFolderId, isBuilding, rowRanges, type ApprovalRow } from '@/lib/approvals';
import { setupValue, slackChannel } from '@/lib/setup';
import { safeWriteMany, type CellResult } from '@/lib/writes';
import { bust } from '@/lib/cache';
import { sendCommand, type SendResult } from './actions';

// The Build panel: pick rows, set where each ad goes, fix what's missing, then hand it to Claude.

export interface PlanRow {
  row: number;
  label: string;
  brand: string;
  product: string;
  adType: string;
  state: string;
  problems: { title: string; fix: string; cols: string[] }[];
  /** Editable cells, as the sheet shows them now. */
  cells: Record<'Y' | 'Z' | 'AO' | 'AP' | 'AQ' | 'AR' | 'AS' | 'AV', string>;
  /** Where a Drive link was typed by mistake (brief or URL column), so it can be moved to Z. */
  driveElsewhere: string | null;
  /** Other unbuilt rows with the same Drive link: Claude splits the folder into one row per creative. */
  sharedWith: number[];
}

export interface BuildPlan {
  ok: boolean;
  error?: string;
  clientName: string;
  rows: PlanRow[];
  actions: string[];
  campaigns: { name: string; adSets: string[] }[];
  adSets: string[];
  chatLink: string | null;
  intervalMinutes: number;
  slack: boolean;
}

const ACTIONS = ['USE EXISTING AD SET', 'CREATE NEW AD SET', 'CREATE NEW CAMPAIGN + NEW AD SET', 'SAME AS ROW ABOVE'];
const isDrive = (s: string) => /drive\.google\.com\//.test(s);

function toPlanRow(r: ApprovalRow, st: { state: string; problems: PlanRow['problems'] }, sharedWith: number[]): PlanRow {
  const elsewhere = [r.brief, r.url].find((v) => isDrive(v)) ?? null;
  return {
    row: r.row,
    label: r.differentiation || r.adId || `Row ${r.row}`,
    brand: r.brand,
    product: r.product,
    adType: r.adType,
    state: st.state,
    problems: st.problems,
    cells: { Y: r.url, Z: r.drive, AO: r.action, AP: r.campaign, AQ: r.adSet, AR: r.copyFrom, AS: r.budget, AV: r.copyNotes },
    driveElsewhere: isDrive(r.drive) ? null : elsewhere,
    sharedWith,
  };
}

/** Rows waiting to be built (or only `only`), with fresh data, plus the live campaign › ad set pairs. */
export async function getBuildPlan(clientId: string, only?: number[]): Promise<BuildPlan> {
  const empty: BuildPlan = { ok: false, clientName: '', rows: [], actions: ACTIONS, campaigns: [], adSets: [], chatLink: null, intervalMinutes: 60, slack: false };
  const pre = await loadClientState(clientId);
  if (!pre.ok) return { ...empty, error: pre.error };
  bust(pre.state.client.sheetId); // the panel always works on the sheet as it is now
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return { ...empty, error: loaded.error };
  const s = loaded.state;

  const byDrive = new Map<string, number[]>();
  for (const r of s.rows) {
    const key = driveFolderId(r.drive);
    if (!key || r.log.built) continue;
    byDrive.set(key, [...(byDrive.get(key) ?? []), r.row]);
  }
  const rows = s.rows
    .filter((r) => (only?.length ? only.includes(r.row) : isBuilding(r) && !r.log.built))
    .map((r) => {
      const key = driveFolderId(r.drive);
      return toPlanRow(r, s.status.get(r.row)!, key ? (byDrive.get(key) ?? []).filter((n) => n !== r.row) : []);
    });

  let campaigns: BuildPlan['campaigns'] = [];
  let adSets: string[] = [];
  let actions = ACTIONS;
  try {
    const meta = await getMeta(s.client.sheetId);
    if (meta.tabs.some((t) => t.title === 'META_LIST')) {
      const [pairs] = await batchGet(s.client.sheetId, [a1('META_LIST', 'A2:B3000')]);
      const map = new Map<string, Set<string>>();
      for (const [c, a] of pairs) {
        if (!c) continue;
        if (!map.has(c)) map.set(c, new Set());
        if (a) map.get(c)!.add(a);
      }
      campaigns = [...map.entries()].map(([name, set]) => ({ name, adSets: [...set].sort() })).sort((x, y) => x.name.localeCompare(y.name));
      adSets = [...new Set(campaigns.flatMap((c) => c.adSets))].sort();
    }
    const first = rows[0]?.row ?? s.rows[0]?.row;
    if (first) {
      const opts = await dropdownOptions(s.client.sheetId, a1(TABS.approvals, `AO${first}`));
      if (opts.length) actions = opts;
    }
  } catch {
    // Without META_LIST the panel still works with free text.
  }

  return {
    ok: true,
    clientName: setupValue(s.setup, 'clientName') || s.client.name,
    rows,
    actions,
    campaigns,
    adSets,
    chatLink: setupValue(s.setup, 'claudeChat') || null,
    intervalMinutes: Number(setupValue(s.setup, 'commandInterval')) || 60,
    slack: !!process.env.SLACK_BOT_TOKEN && !!process.env.CLAUDE_SLACK_USER_ID,
  };
}

export interface RowEdit {
  row: number;
  col: string;
  expected: string;
  value: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  saved: number;
  results: (CellResult & { row: number; col: string })[];
}

/** Writes the panel's edits in one batch, re-reading every cell first. */
export async function saveRowEdits(clientId: string, edits: RowEdit[]): Promise<SaveResult> {
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return { ok: false, error: loaded.error, saved: 0, results: [] };
  const bad = edits.find((e) => !isWritableApprovalCol(e.col) || !Number.isInteger(e.row) || e.row < 6);
  if (bad) return { ok: false, error: `Column ${bad.col} can’t be written from the app.`, saved: 0, results: [] };
  try {
    const res = await safeWriteMany(
      loaded.state.client.sheetId,
      edits.map((e) => ({ range: a1(TABS.approvals, `${e.col}${e.row}`), expected: e.expected, value: e.value })),
    );
    revalidatePath(`/c/${clientId}`, 'layout');
    const results = res.map((r, i) => ({ ...r, row: edits[i].row, col: edits[i].col }));
    return { ok: results.every((r) => r.ok), saved: results.filter((r) => r.ok).length, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), saved: 0, results: [] };
  }
}

/** Saves the edits, then asks Claude to build the chosen rows (and only those). */
export async function submitBuild(clientId: string, edits: RowEdit[], rows: number[], note: string): Promise<{ save: SaveResult; command: SendResult | null }> {
  const save = await saveRowEdits(clientId, edits);
  if (save.error) return { save, command: null };
  const args = [`rows ${rowRanges(rows)}`, note.trim() ? `note: ${note.trim()}` : ''].filter(Boolean).join(' · ');
  const command = await sendCommand(clientId, 'BUILD', args);
  return { save, command };
}

/** Asks Claude to fix rows whose answer is in the sheet or Drive (misplaced links, blank tags). */
export async function askClaudeToFix(clientId: string, rows: number[], problem: string, note = ''): Promise<SendResult> {
  const args = [`rows ${rowRanges(rows)}: ${problem}`, note.trim() ? `note: ${note.trim()}` : ''].filter(Boolean).join(' · ');
  return sendCommand(clientId, 'FIX_ROWS', args);
}
