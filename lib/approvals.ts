// Pure parsing and status logic for AD APPROVALS, COPY and HOOKS.
// No I/O here, so it can be unit tested and shared with the client.

import { APPROVALS_FIRST_ROW, COPY_FIRST_ROW, HOOKS_FIRST_ROW, STATUS_BUILDING, colToIndex } from './columns.ts';

export type RowState = 'ready' | 'fix' | 'built' | 'other';

export interface BuildLog {
  raw: string;
  built: boolean;
  failed: string | null;
  campaignId: string | null;
  adSetId: string | null;
  adId: string | null;
  date: string | null; // YYYY-MM-DD
  warnings: string[];
  organized: string | null;
}

export interface ApprovalRow {
  row: number;
  status: string; // B
  adId: string; // D (formula)
  adName: string; // E (formula)
  copySet: string; // F
  headlines: string[]; // G–K (formula)
  primaryTexts: string[]; // L–P
  descriptions: string[]; // Q–U
  hook: string; // V
  hookText: string; // W
  cta: string; // X
  url: string; // Y
  drive: string; // Z
  brief: string; // AA
  briefStatus: string; // AB
  startDate: string; // AC
  endDate: string; // AD
  adNameAuto: string; // AE (formula)
  brand: string; // AF
  funnel: string; // AG
  angle: string; // AJ
  adType: string; // AK
  product: string; // AL
  differentiation: string; // AM
  landingPage: string; // AN
  action: string; // AO
  campaign: string; // AP
  adSet: string; // AQ
  copyFrom: string; // AR
  budget: string; // AS
  copyNotes: string; // AV: instructions for the copy; blank = Claude writes from the creative
  check: string; // AT (formula)
  log: BuildLog; // AU
}

export interface CopySet {
  row: number;
  code: string;
  name: string;
  brand: string;
  angle: string;
  status: string;
  headlines: string[];
  primaryTexts: string[];
  descriptions: string[];
  label: string;
}

export interface Hook {
  row: number;
  code: string;
  text: string;
  brand: string;
  type: string;
  status: string;
  onScreen: string;
}

export interface Problem {
  /** Short label, e.g. "Destination not set". */
  title: string;
  /** What to do, in the words the skill uses in Slack. */
  fix: string;
  cols: string[];
}

export interface StatusResult {
  state: RowState;
  problems: Problem[];
}

const cell = (r: string[], col: string) => (r[colToIndex(col)] ?? '').toString().trim();
const range = (r: string[], from: string, to: string) => {
  const out: string[] = [];
  for (let i = colToIndex(from); i <= colToIndex(to); i++) out.push((r[i] ?? '').toString().trim());
  return out.filter(Boolean);
};

/**
 * AU comes in a few shapes, all written by Claude:
 *   BUILT | AD 1202... | PAUSED | 2026-10-16 | ⚠ video Iron Man, URL Black Panther
 *   ADSET_CREATED 1202... | AD 1202... | PAUSED | 2026-10-16
 *   CAMPAIGN_CREATED:<id> | ADSET_CREATED:<id> | AD_ID:<id> | <date> | <note>
 *   FAILED: <reason>
 *   ORGANIZED:<n> creatives | dims:<…> | <date>
 */
export function parseBuildLog(raw: string): BuildLog {
  const text = (raw ?? '').trim();
  const id = (key: string) => text.match(new RegExp(`\\b${key}[:\\s]+(\\d{6,})`))?.[1] ?? null;
  const adId = id('AD_ID') ?? id('AD');
  const failed = text.match(/\bFAILED:\s*([^|]*)/i)?.[1]?.trim() || null;
  const built = !failed && (/^(BUILT|ADSET_CREATED|CAMPAIGN_CREATED)\b/i.test(text) || /\bAD_ID:/.test(text));
  const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  const warnings = text
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.includes('⚠'))
    .map((s) => s.replace(/^⚠\s*/, '').trim());
  const organized = text.match(/ORGANIZED:\s*([^|]*)/)?.[1]?.trim() ?? null;
  return {
    raw: text,
    built,
    failed,
    campaignId: id('CAMPAIGN_CREATED'),
    adSetId: id('ADSET_CREATED'),
    adId,
    date: dates ? dates[dates.length - 1] : null,
    warnings,
    organized,
  };
}

/**
 * The skill builds from the A–AU layout: AO "① WHAT DOES CLAUDE DO?" … AU "BUILD LOG".
 * Older control sheets have a shorter layout (headline and copy typed in the row, no destination).
 */
export function approvalsLayoutIssue(header: string[]): string | null {
  const at = (col: string) => (header[colToIndex(col)] ?? '').toString().toUpperCase();
  if (at('AU').includes('BUILD LOG') && at('AO').includes('CLAUDE') && at('F').includes('COPY')) return null;
  const width = header.filter((h) => (h ?? '').toString().trim()).length;
  return `AD APPROVALS uses the old layout (${width} columns, no COPY SET, destination or BUILD LOG columns). The skill and the app need the new A–AU layout.`;
}

export function parseApprovals(values: string[][], firstRow = APPROVALS_FIRST_ROW): ApprovalRow[] {
  const rows: ApprovalRow[] = [];
  values.forEach((r, i) => {
    const status = cell(r, 'B');
    // Section label rows ("New August Creatives - EVO") and blank rows have no status.
    if (!status || status.toUpperCase() === 'EXAMPLE') return;
    rows.push({
      row: firstRow + i,
      status,
      adId: cell(r, 'D'),
      adName: cell(r, 'E'),
      copySet: cell(r, 'F'),
      headlines: range(r, 'G', 'K'),
      primaryTexts: range(r, 'L', 'P'),
      descriptions: range(r, 'Q', 'U'),
      hook: cell(r, 'V'),
      hookText: cell(r, 'W'),
      cta: cell(r, 'X'),
      url: cell(r, 'Y'),
      drive: cell(r, 'Z'),
      brief: cell(r, 'AA'),
      briefStatus: cell(r, 'AB'),
      startDate: cell(r, 'AC'),
      endDate: cell(r, 'AD'),
      adNameAuto: cell(r, 'AE'),
      brand: cell(r, 'AF') || cell(r, 'C'),
      funnel: cell(r, 'AG'),
      angle: cell(r, 'AJ'),
      adType: cell(r, 'AK'),
      product: cell(r, 'AL'),
      differentiation: cell(r, 'AM'),
      landingPage: cell(r, 'AN'),
      action: cell(r, 'AO'),
      campaign: cell(r, 'AP'),
      adSet: cell(r, 'AQ'),
      copyFrom: cell(r, 'AR'),
      budget: cell(r, 'AS'),
      copyNotes: cell(r, 'AV'),
      check: cell(r, 'AT'),
      log: parseBuildLog(cell(r, 'AU')),
    });
  });
  return rows;
}

export function parseCopy(values: string[][]): CopySet[] {
  return values
    .map((r, i) => ({
      row: COPY_FIRST_ROW + i,
      code: cell(r, 'A'),
      name: cell(r, 'B'),
      brand: cell(r, 'C'),
      angle: cell(r, 'D'),
      status: cell(r, 'E'),
      headlines: range(r, 'K', 'O'),
      primaryTexts: range(r, 'P', 'T'),
      descriptions: range(r, 'U', 'Y'),
      label: cell(r, 'AA'),
    }))
    .filter((c) => c.code && c.name); // a row is "free" when B is empty
}

export function parseHooks(values: string[][]): Hook[] {
  return values
    .map((r, i) => ({
      row: HOOKS_FIRST_ROW + i,
      code: cell(r, 'A'),
      text: cell(r, 'B'),
      brand: cell(r, 'C'),
      type: cell(r, 'D'),
      status: cell(r, 'E'),
      onScreen: cell(r, 'K'),
    }))
    .filter((h) => h.code && h.text);
}

/** F holds the label; its first 5 characters are the code (CP007). */
export const copyCode = (label: string) => label.trim().slice(0, 5);
/** V holds the label; its first 4 characters are the code (H006). */
export const hookCode = (label: string) => label.trim().slice(0, 4);

export const isDriveLink = (s: string) => /^https?:\/\/(drive|docs)\.google\.com\//.test(s);
export const driveFolderId = (s: string) => s.match(/\/folders\/([\w-]+)/)?.[1] ?? null;
/** Only digits in Z (e.g. 17890123456789012, or page_post 123_456) = a creator's post ID → partnership ad, no Drive folder. */
export const isCreatorPostId = (s: string) => /^\d{8,}(_\d{8,})?$/.test(s.trim());
export const isBuilding = (r: ApprovalRow) => r.status.toLowerCase() === STATUS_BUILDING.toLowerCase();

/**
 * Same checks, in the same order, as section 3b of the skill.
 * Ready = B is "Building in ads manager", AT ✓, Z a Drive folder link, F set (or Claude writes it), AO–AQ filled.
 * Needs fix = any of those missing, or AU has ⚠ / FAILED.
 * Built = AU starts with BUILT or ADSET_CREATED (or has AD_ID:).
 */
export function rowStatus(r: ApprovalRow, copy: Map<string, CopySet>): StatusResult {
  const problems: Problem[] = [];

  for (const w of r.log.warnings) {
    problems.push({ title: `Check before turning on: ${w}`, fix: 'Fix Y if the link is wrong, then ask Claude to re-check.', cols: ['Y'] });
  }
  if (r.log.failed) {
    problems.push({ title: `Build failed: ${r.log.failed}`, fix: 'Fix the cause, then ask Claude to build again.', cols: ['AU'] });
  }
  if (r.log.built && !r.log.failed) return { state: problems.length ? 'fix' : 'built', problems };
  if (!isBuilding(r)) return { state: 'other', problems };

  // Section 3b: run the checks in order and stop at the first failure.
  const first = firstFailure(r, copy);
  if (first) problems.push(first);

  return { state: problems.length ? 'fix' : 'ready', problems };
}

function firstFailure(r: ApprovalRow, copy: Map<string, CopySet>): Problem | null {
  const partnership = isCreatorPostId(r.drive);
  // The sheet's AT formula only knows Drive links; a post ID in Z is fine.
  if (partnership && r.check.startsWith('✗') && /\bZ\b|drive/i.test(r.check)) return firstFailureAfterZ(r, copy);
  if (r.check.startsWith('✗')) return { title: r.check.replace(/^✗\s*/, ''), fix: 'Do what the sheet check (AT) says.', cols: ['AT'] };
  if (r.check && !r.check.includes('✓')) return { title: `Sheet check says: ${r.check}`, fix: 'Do what AT says.', cols: ['AT'] };
  if (partnership) return firstFailureAfterZ(r, copy);
  if (!r.drive) return { title: 'No creative link', fix: 'Paste the Drive folder link in Z.', cols: ['Z'] };
  if (!isDriveLink(r.drive)) return { title: 'Assets not in Drive', fix: 'Move to Drive and paste the folder link in Z.', cols: ['Z'] };
  if (!driveFolderId(r.drive)) return { title: 'Z is a file, not a folder', fix: 'Paste the creative’s Drive folder link in Z.', cols: ['Z'] };
  return firstFailureAfterZ(r, copy);
}

function firstFailureAfterZ(r: ApprovalRow, copy: Map<string, CopySet>): Problem | null {
  if (!r.url) return { title: 'No website URL', fix: 'Fill Y with the product URL.', cols: ['Y'] };
  const dest = { AO: r.action, AP: r.campaign, AQ: r.adSet };
  const missing = (['AO', 'AP', 'AQ'] as const).filter((c) => !dest[c]);
  if (missing.length && r.action.toUpperCase() !== 'SAME AS ROW ABOVE') return { title: 'Destination not set', fix: `Fill ${missing.join(' + ')}.`, cols: missing };
  if (r.copySet) {
    const set = copy.get(copyCode(r.copySet));
    if (!set) return { title: `Copy set ${copyCode(r.copySet)} not in COPY`, fix: 'Pick a copy set in F, or clear F so Claude writes one.', cols: ['F'] };
    if (set.status && set.status.toLowerCase() !== 'active') return { title: `Copy set ${set.code} is ${set.status}`, fix: 'Pick an Active copy set in F, or clear F.', cols: ['F'] };
  }
  return null;
}

/** The 7 pipeline steps of the skill, as a per-row checklist. */
export interface Step {
  label: string;
  detail: string;
  done: boolean;
}

export function pipelineSteps(r: ApprovalRow, copy: Map<string, CopySet>): Step[] {
  const set = r.copySet ? copy.get(copyCode(r.copySet)) : undefined;
  const tagsFilled = [r.brand, r.funnel, r.angle, r.adType, r.product, r.differentiation, r.landingPage].every(Boolean);
  const isVideo = r.adType.toLowerCase() === 'video';
  return [
    {
      label: 'Own Drive folder',
      detail: isCreatorPostId(r.drive)
        ? `Creator post ${r.drive.trim()} · partnership ad`
        : driveFolderId(r.drive)
          ? r.log.organized ?? 'Z points to a folder'
          : r.drive
            ? 'Z is not a folder link'
            : 'Z is empty',
      done: !!driveFolderId(r.drive) || isCreatorPostId(r.drive),
    },
    {
      label: 'Analyzed',
      detail: [r.product, r.adType, isVideo ? (r.hook ? hookCode(r.hook) : 'no hook yet') : ''].filter(Boolean).join(' · ') || 'Claude analyzes on build day',
      done: !!r.product && (!isVideo || !!r.hook),
    },
    {
      label: 'Copy in COPY tab',
      detail: set ? `${set.code} · ${set.name}` : r.copySet ? `${copyCode(r.copySet)} not found` : 'Claude writes it on build day',
      done: !!set,
    },
    {
      label: 'Tags and ad name',
      detail: r.adNameAuto || 'AF–AN not filled yet',
      done: tagsFilled && !!r.adNameAuto,
    },
    {
      label: 'Destination',
      detail: r.action ? [r.action, r.campaign, r.adSet].filter(Boolean).join(' › ') : 'AO–AQ empty',
      done: !!(r.action && (r.action.toUpperCase() === 'SAME AS ROW ABOVE' || (r.campaign && r.adSet))),
    },
    {
      label: 'Launched, paused',
      detail: r.log.adId ? `Ad ${r.log.adId}` : r.log.failed ? `Failed: ${r.log.failed}` : 'Not built yet',
      done: !!r.log.adId,
    },
    {
      label: 'Logged and posted',
      detail: r.log.built && r.log.date ? `AU · ${r.log.date}` : 'Not yet',
      done: r.log.built && !!r.log.date,
    },
  ];
}

/** Rows the app shows: in the build queue, or built in the last `days`. */
export function isActiveRow(r: ApprovalRow, today: string, days = 21): boolean {
  if (isBuilding(r) && !r.log.built) return true;
  if (r.log.built && r.log.date) return daysBetween(r.log.date, today) <= days;
  return isBuilding(r);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

/** "113–122, 124" from [113,…,122,124]. */
export function rowRanges(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`);
    i = j;
  }
  return out.join(', ');
}
