import 'server-only';
import { readFileSync } from 'node:fs';
import { IdentityPoolClient, JWT } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import { colToIndex } from './columns.ts';
import { bust, memo } from './cache.ts';

// Thin REST wrappers around the Sheets and Drive APIs, authenticated as the service account.
// Two ways to sign in as the service account:
//  - keyless (preferred on Vercel): Workload Identity Federation with the Vercel OIDC token,
//    when GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID is set;
//  - a JSON key in GOOGLE_SERVICE_ACCOUNT_JSON.
// Set FAKE_SHEETS_FILE to a local JSON fixture to run the UI without Google (dev only).

export class GoogleError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'];

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let account: ServiceAccount | null = null;
let auth: { getAccessToken(): Promise<{ token?: string | null }> } | null = null;

const federated = () => !!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;

function authClient() {
  if (auth) return auth;
  if (federated()) {
    const env = process.env;
    const pool = `projects/${env.GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${env.GCP_WORKLOAD_IDENTITY_POOL_ID}`;
    auth = new IdentityPoolClient({
      audience: `//iam.googleapis.com/${pool}/providers/${env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
      scopes: SCOPES,
    });
  } else {
    const sa = serviceAccount();
    auth = new JWT({ email: sa.client_email, key: sa.private_key, scopes: SCOPES });
  }
  return auth;
}

function serviceAccount(): ServiceAccount {
  if (account) return account;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new GoogleError('GOOGLE_SERVICE_ACCOUNT_JSON is not set', 500);
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  account = JSON.parse(json) as ServiceAccount;
  return account;
}

export function serviceAccountEmail(): string {
  if (fake()) return 'ad-builder@example.iam.gserviceaccount.com';
  if (federated()) return process.env.GCP_SERVICE_ACCOUNT_EMAIL ?? '(service account not configured)';
  try {
    return serviceAccount().client_email;
  } catch {
    return '(service account not configured)';
  }
}

const RETRY_MS = [1500, 4000, 9000];

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { token } = await authClient().getAccessToken();
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
    // Google answers 429 when the per-minute read quota is used up; it clears within the minute.
    if ((res.status !== 429 && res.status !== 503) || attempt >= RETRY_MS.length) break;
    await new Promise((r) => setTimeout(r, RETRY_MS[attempt]));
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    throw new GoogleError(message, res.status);
  }
  return (await res.json()) as T;
}

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const enc = encodeURIComponent;

export type Render = 'FORMATTED_VALUE' | 'FORMULA';

export interface SheetMeta {
  title: string;
  tabs: { title: string; sheetId: number }[];
}

const READ_TTL = 30_000;

export async function getMeta(spreadsheetId: string): Promise<SheetMeta> {
  if (fake()) return fakeMeta(spreadsheetId);
  return memo(`meta|${spreadsheetId}`, READ_TTL, () => loadMeta(spreadsheetId));
}

async function loadMeta(spreadsheetId: string): Promise<SheetMeta> {
  const r = await gfetch<{ properties: { title: string }; sheets: { properties: { title: string; sheetId: number } }[] }>(
    `${SHEETS}/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
  );
  return { title: r.properties.title, tabs: r.sheets.map((s) => s.properties) };
}

/** Cached for 30 s; pass `fresh` to read the sheet as it is right now (before a write). */
export async function batchGet(spreadsheetId: string, ranges: string[], render: Render = 'FORMATTED_VALUE', fresh = false): Promise<string[][][]> {
  if (fake()) return ranges.map((r) => fakeGet(spreadsheetId, r, render));
  if (fresh) return loadValues(spreadsheetId, ranges, render);
  return memo(`values|${spreadsheetId}|${render}|${ranges.join(',')}`, READ_TTL, () => loadValues(spreadsheetId, ranges, render));
}

async function loadValues(spreadsheetId: string, ranges: string[], render: Render): Promise<string[][][]> {
  const q = ranges.map((r) => `ranges=${enc(r)}`).join('&');
  const r = await gfetch<{ valueRanges: { values?: string[][] }[] }>(
    `${SHEETS}/${spreadsheetId}/values:batchGet?${q}&valueRenderOption=${render}`,
  );
  return r.valueRanges.map((v) => v.values ?? []);
}

/** Writes as if typed by a person, so dropdown values and URLs behave like in the sheet. */
export async function updateValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  if (fake()) return fakeUpdate(spreadsheetId, range, values);
  await gfetch(`${SHEETS}/${spreadsheetId}/values/${enc(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ range, values }),
  });
  bust(spreadsheetId);
}

/** Several ranges in one request (one write against the quota). */
export async function batchUpdateValues(spreadsheetId: string, data: { range: string; values: string[][] }[]): Promise<void> {
  if (!data.length) return;
  if (fake()) return data.forEach((d) => fakeUpdate(spreadsheetId, d.range, d.values));
  await gfetch(`${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });
  bust(spreadsheetId);
}

/** Appends below the last row. RAW so nothing turns into a date or a number. */
export async function appendValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  if (fake()) return fakeAppend(spreadsheetId, range, values);
  await gfetch(`${SHEETS}/${spreadsheetId}/values/${enc(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  });
  bust(spreadsheetId);
}

export async function addTab(spreadsheetId: string, title: string): Promise<void> {
  if (fake()) return void (fakeStore().spreadsheets[spreadsheetId].tabs[title] ??= []);
  await gfetch(`${SHEETS}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  bust(spreadsheetId);
}

/** Copies one tab from a template spreadsheet and gives it its original name. */
export async function copyTabFrom(templateId: string, tabTitle: string, destinationId: string): Promise<void> {
  if (fake()) {
    const src = fakeStore().spreadsheets[templateId]?.tabs[tabTitle];
    fakeStore().spreadsheets[destinationId].tabs[tabTitle] = structuredClone(src ?? []);
    return;
  }
  const meta = await getMeta(templateId);
  const tab = meta.tabs.find((t) => t.title === tabTitle);
  if (!tab) throw new GoogleError(`Template sheet has no "${tabTitle}" tab`, 404);
  const copied = await gfetch<{ sheetId: number }>(`${SHEETS}/${templateId}/sheets/${tab.sheetId}:copyTo`, {
    method: 'POST',
    body: JSON.stringify({ destinationSpreadsheetId: destinationId }),
  });
  await gfetch(`${SHEETS}/${destinationId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ updateSheetProperties: { properties: { sheetId: copied.sheetId, title: tabTitle }, fields: 'title' } }],
    }),
  });
  bust(destinationId);
}

/** Dropdown options of a cell (data validation ONE_OF_LIST), or [] when it is free text. */
export async function dropdownOptions(spreadsheetId: string, a1: string): Promise<string[]> {
  if (fake()) return fakeStore().dropdowns?.[a1.replace(/\d+$/, '')] ?? [];
  // Dropdown lists rarely change; one read per column every 10 minutes.
  return memo(`dropdown|${spreadsheetId}|${a1.replace(/\d+$/, '')}`, 600_000, () => loadDropdown(spreadsheetId, a1));
}

async function loadDropdown(spreadsheetId: string, a1: string): Promise<string[]> {
  type V = { sheets?: { data?: { rowData?: { values?: { dataValidation?: { condition?: { type: string; values?: { userEnteredValue: string }[] } } }[] }[] }[] }[] };
  const r = await gfetch<V>(`${SHEETS}/${spreadsheetId}?ranges=${enc(a1)}&fields=sheets.data.rowData.values.dataValidation`);
  const cond = r.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation?.condition;
  if (cond?.type === 'ONE_OF_LIST') return (cond.values ?? []).map((v) => v.userEnteredValue);
  if (cond?.type === 'ONE_OF_RANGE') {
    // e.g. =META_LIST!$D$2:$D$3000 (campaigns / ad sets): read that range.
    const range = (cond.values?.[0]?.userEnteredValue ?? '').replace(/^=/, '').replace(/\$/g, '');
    if (!range) return [];
    const [values] = await batchGet(spreadsheetId, [range]);
    return [...new Set(values.flat().map((v) => String(v ?? '').trim()).filter(Boolean))];
  }
  return [];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  if (fake()) return fakeStore().drive?.[folderId] ?? [];
  return memo(`folder|${folderId}`, 300_000, () => loadFolder(folderId));
}

async function loadFolder(folderId: string): Promise<DriveFile[]> {
  const q = enc(`'${folderId}' in parents and trashed = false`);
  const r = await gfetch<{ files: DriveFile[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      `&fields=files(id,name,mimeType,thumbnailLink,videoMediaMetadata(width,height,durationMillis))&orderBy=name`,
  );
  return r.files;
}

export async function driveReachable(folderId: string): Promise<boolean> {
  if (fake()) return true;
  return memo(`drive-ok|${folderId}`, 300_000, async () => {
    try {
      await gfetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id&supportsAllDrives=true`);
      return true;
    } catch {
      return false;
    }
  });
}

/* ---------------- dev fixture (FAKE_SHEETS_FILE) ---------------- */

interface FakeStore {
  spreadsheets: Record<string, { title: string; tabs: Record<string, string[][]> }>;
  dropdowns?: Record<string, string[]>;
  drive?: Record<string, DriveFile[]>;
}

const fake = () => !!process.env.FAKE_SHEETS_FILE && process.env.NODE_ENV !== 'production';
const g = globalThis as unknown as { __fakeSheets?: FakeStore };

function fakeStore(): FakeStore {
  g.__fakeSheets ??= JSON.parse(readFileSync(process.env.FAKE_SHEETS_FILE!, 'utf8')) as FakeStore;
  return g.__fakeSheets;
}

function fakeSheet(id: string) {
  const s = fakeStore().spreadsheets[id];
  if (!s) throw new GoogleError('The caller does not have permission', 403);
  return s;
}

function fakeMeta(id: string): SheetMeta {
  const s = fakeSheet(id);
  return { title: s.title, tabs: Object.keys(s.tabs).map((title, i) => ({ title, sheetId: i })) };
}

function parseA1(range: string) {
  const m = range.match(/^(?:'((?:[^']|'')+)'|([^!]+))!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
  if (!m) throw new GoogleError(`Bad range ${range}`, 400);
  const tab = (m[1] ?? m[2]).replace(/''/g, "'");
  return { tab, c0: colToIndex(m[3]), r0: Number(m[4] ?? 1) - 1, c1: colToIndex(m[5] ?? m[3]), r1: m[6] ? Number(m[6]) - 1 : m[5] ? Infinity : Number(m[4] ?? 1) - 1 };
}

function fakeGet(id: string, range: string, render: Render): string[][] {
  const { tab, c0, r0, c1, r1 } = parseA1(range);
  const grid = fakeSheet(id).tabs[tab];
  if (!grid) throw new GoogleError(`Unable to parse range: ${range}`, 400);
  const rows = grid.slice(r0, r1 === Infinity ? undefined : r1 + 1).map((r) => r.slice(c0, c1 + 1).map((v) => (render === 'FORMATTED_VALUE' && v?.startsWith?.('=') ? '' : v ?? '')));
  while (rows.length && rows[rows.length - 1].every((v) => !v)) rows.pop();
  return rows;
}

function fakeUpdate(id: string, range: string, values: string[][]) {
  const { tab, c0, r0 } = parseA1(range);
  const grid = (fakeSheet(id).tabs[tab] ??= []);
  values.forEach((row, i) => {
    grid[r0 + i] ??= [];
    row.forEach((v, j) => {
      while (grid[r0 + i].length < c0 + j) grid[r0 + i].push('');
      grid[r0 + i][c0 + j] = v;
    });
  });
}

function fakeAppend(id: string, range: string, values: string[][]) {
  const { tab } = parseA1(range);
  const grid = (fakeSheet(id).tabs[tab] ??= []);
  grid.push(...values.map((r) => [...r]));
}
