import 'server-only';
import { cache } from 'react';
import { a1, ADDABLE_TABS, APPROVALS_FIRST_ROW, APPROVALS_HEADER_ROW, APPROVALS_LAST_COL, COPY_FIRST_ROW, HOOKS_FIRST_ROW, REQUIRED_TABS, TABS } from './columns.ts';
import { batchGet, getMeta, GoogleError } from './google.ts';
import { approvalsLayoutIssue, parseApprovals, parseCopy, parseHooks, rowStatus, type ApprovalRow, type CopySet, type Hook, type StatusResult } from './approvals.ts';
import { parseSetup, setupValue, SETUP_RANGE, type Setup } from './setup.ts';
import { parseCommands, type Command } from './commands.ts';

// Reads only. Everything is cached for the length of one request (React cache), never stored.

export const MASTER_TAB = process.env.MASTER_TAB ?? 'CLIENTS';
export const MASTER_HEADER = ['client_id', 'name', 'control_sheet_id', 'drive_root_id', 'status', 'added_on', 'offboarded_on'];

export interface Client {
  row: number;
  id: string;
  name: string;
  sheetId: string;
  driveRootId: string;
  status: 'Active' | 'Offboarded' | string;
  /** The cell as it is (blank counts as Active). */
  statusRaw: string;
  addedOn: string;
  offboardedOn: string;
}

export function masterSheetId(): string {
  const id = process.env.MASTER_SHEET_ID;
  if (!id) throw new GoogleError('MASTER_SHEET_ID is not set', 500);
  return id;
}

export const loadClients = cache(async (): Promise<Client[]> => {
  const [values] = await batchGet(masterSheetId(), [a1(MASTER_TAB, 'A2:G')]);
  return values
    .map((r, i) => ({
      row: i + 2,
      id: (r[0] ?? '').trim(),
      name: (r[1] ?? '').trim(),
      sheetId: (r[2] ?? '').trim(),
      driveRootId: (r[3] ?? '').trim(),
      status: (r[4] ?? '').trim() || 'Active',
      statusRaw: r[4] ?? '',
      addedOn: (r[5] ?? '').trim(),
      offboardedOn: (r[6] ?? '').trim(),
    }))
    .filter((c) => c.id);
});

export const activeClients = async () => (await loadClients()).filter((c) => c.status !== 'Offboarded');

export const getClient = cache(async (id: string) => (await loadClients()).find((c) => c.id === id) ?? null);

export interface ClientState {
  client: Client;
  sheetTitle: string;
  missingTabs: string[];
  /** Set when AD APPROVALS is not the layout the skill builds from (A–AU with ① … BUILD LOG). */
  layoutIssue: string | null;
  setup: Setup | null;
  rows: ApprovalRow[];
  copy: CopySet[];
  copyByCode: Map<string, CopySet>;
  hooks: Hook[];
  commands: Command[];
  status: Map<number, StatusResult>;
  today: string;
  timezone: string;
}

export type LoadResult = { ok: true; state: ClientState } | { ok: false; error: string; kind: 'access' | 'other' };

export const loadClientState = cache(async (clientId: string): Promise<LoadResult> => {
  const client = await getClient(clientId);
  if (!client) return { ok: false, kind: 'other', error: `No client "${clientId}" in the master sheet.` };
  try {
    const meta = await getMeta(client.sheetId);
    const tabs = new Set(meta.tabs.map((t) => t.title));
    const missingTabs = [...REQUIRED_TABS, ...ADDABLE_TABS].filter((t) => !tabs.has(t));
    const ranges: [string, string][] = [
      [TABS.approvals, `A${APPROVALS_FIRST_ROW}:${APPROVALS_LAST_COL}`],
      [TABS.copy, `A${COPY_FIRST_ROW}:AA`],
      [TABS.hooks, `A${HOOKS_FIRST_ROW}:O`],
      [TABS.setup, SETUP_RANGE],
      [TABS.commands, 'A2:L'],
    ];
    const present = ranges.filter(([t]) => tabs.has(t));
    const header = tabs.has(TABS.approvals) ? [a1(TABS.approvals, `A${APPROVALS_HEADER_ROW}:${APPROVALS_LAST_COL}${APPROVALS_HEADER_ROW}`)] : [];
    const got = await batchGet(client.sheetId, [...present.map(([t, r]) => a1(t, r)), ...header]);
    const by = new Map(present.map(([t], i) => [t, got[i]]));
    const layoutIssue = header.length ? approvalsLayoutIssue(got[got.length - 1][0] ?? []) : null;

    const setup = by.has(TABS.setup) ? parseSetup(by.get(TABS.setup)!) : null;
    const timezone = setupValue(setup, 'timezone') || process.env.DEFAULT_TIMEZONE || 'UTC';
    const copy = parseCopy(by.get(TABS.copy) ?? []);
    const copyByCode = new Map(copy.map((c) => [c.code, c]));
    // An old-layout tab would be read into the wrong fields, so its rows are not shown.
    const rows = layoutIssue ? [] : parseApprovals(by.get(TABS.approvals) ?? []);
    return {
      ok: true,
      state: {
        client,
        sheetTitle: meta.title,
        missingTabs,
        layoutIssue,
        setup,
        rows,
        copy,
        copyByCode,
        hooks: parseHooks(by.get(TABS.hooks) ?? []),
        commands: parseCommands(by.get(TABS.commands) ?? []),
        status: new Map(rows.map((r) => [r.row, rowStatus(r, copyByCode)])),
        today: todayIn(timezone),
        timezone,
      },
    };
  } catch (e) {
    if (e instanceof GoogleError && (e.status === 403 || e.status === 404 || e.status === 401)) {
      return { ok: false, kind: 'access', error: e.message };
    }
    return { ok: false, kind: 'other', error: e instanceof Error ? e.message : String(e) };
  }
});

export function todayIn(timeZone: string, d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}`;
export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
