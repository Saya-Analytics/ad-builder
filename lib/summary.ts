// What the screens show, derived from one ClientState. Every number here is counted from the sheet.

import { isActiveRow, rowRanges, driveFolderId, type ApprovalRow } from './approvals.ts';
import { isStale, type Command } from './commands.ts';
import { setupValue } from './setup.ts';
import type { ClientState } from './data.ts';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function activeRows(s: ClientState): ApprovalRow[] {
  return s.rows.filter((r) => isActiveRow(r, s.today));
}

export function counts(s: ClientState, rows = activeRows(s)) {
  const st = (r: ApprovalRow) => s.status.get(r.row)!.state;
  const ready = rows.filter((r) => st(r) === 'ready');
  const fix = rows.filter((r) => st(r) === 'fix');
  const built = rows.filter((r) => st(r) === 'built');
  return { ready, fix, built, total: rows.length };
}

export function brandCounts(s: ClientState, rows = activeRows(s)) {
  const m = new Map<string, number>();
  for (const b of s.setup?.brands ?? []) m.set(b.brand, 0);
  for (const r of rows) m.set(r.brand || '—', (m.get(r.brand || '—') ?? 0) + 1);
  return [...m.entries()].map(([brand, n]) => ({ brand, n }));
}

export function daysToBuild(s: ClientState): { day: string; days: number } | null {
  const day = setupValue(s.setup, 'buildDay');
  const target = WEEKDAYS.findIndex((d) => d.toLowerCase() === day.toLowerCase());
  if (target < 0) return null;
  const now = new Date(s.today + 'T12:00:00Z').getUTCDay();
  return { day: WEEKDAYS[target], days: (target - now + 7) % 7 };
}

export interface Blocker {
  title: string;
  fix: string;
  action: string;
  href: string;
}

export function blockers(s: ClientState, intervalMinutes: number, base: string): Blocker[] {
  const out: Blocker[] = [];
  if (s.layoutIssue) {
    out.push({ title: 'Old AD APPROVALS layout', fix: 'The sheet needs the new A–AU layout before Claude can build from it', action: 'See', href: `/clients#${s.client.id}` });
  }
  if (s.missingTabs.length) {
    out.push({ title: 'Setup incomplete', fix: `Missing tabs: ${s.missingTabs.join(', ')}`, action: 'Open', href: `/clients#${s.client.id}` });
  }
  // Group row problems by cause, like the skill's Slack roadblocks.
  const byTitle = new Map<string, { fix: string; rows: number[] }>();
  for (const r of activeRows(s)) {
    for (const p of s.status.get(r.row)!.problems) {
      const g = byTitle.get(p.title) ?? { fix: p.fix, rows: [] };
      g.rows.push(r.row);
      byTitle.set(p.title, g);
    }
  }
  for (const [title, g] of byTitle) {
    const one = g.rows.length === 1;
    out.push({
      title: `${one ? 'Row' : 'Rows'} ${rowRanges(g.rows)}: ${lowerFirst(title)}`,
      fix: g.fix,
      action: 'Fix',
      href: `${base}/rows/${g.rows[0]}`,
    });
  }
  for (const b of s.setup?.brands ?? []) {
    if (b.confirmed) continue;
    out.push({
      title: b.candidates.length > 1 ? `${b.brand} has ${b.candidates.length} ad accounts` : `${b.brand} has no ad account`,
      fix: b.candidates.length > 1 ? b.candidates.join(' or ') : 'Add its act_… in CLAUDE SETUP',
      action: 'Pick',
      href: `${base}/settings#brand-${b.row}`,
    });
  }
  if (s.setup && !setupValue(s.setup, 'afterBuildStatus')) {
    out.push({ title: 'Column B after build is not set', fix: 'Claude leaves B as is until you choose', action: 'Choose', href: `${base}/settings#afterBuildStatus` });
  }
  for (const c of s.commands) {
    if (isStale(c, intervalMinutes)) {
      out.push({ title: `Claude hasn’t picked up ${c.command} yet`, fix: `Requested ${shortTime(c.requestedAt)}`, action: 'Nudge', href: `${base}/commands#${c.id}` });
    }
    if (c.status === 'failed' && recent(c, s.today)) {
      out.push({ title: `${c.command} failed`, fix: c.note || 'No note from Claude', action: 'See', href: `${base}/commands#${c.id}` });
    }
  }
  return out;
}

const shortTime = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }) : iso;
};
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const recent = (c: Command, today: string) => (c.finishedAt || c.requestedAt).slice(0, 10) >= shiftDate(today, -7);

export function shiftDate(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface BuildBrand {
  brand: string;
  account: string | null;
  campaign: string;
  adSet: string;
  adSetIds: string[];
  adIds: string[];
  rows: number[];
  warnings: { row: number; text: string }[];
}

export interface Build {
  date: string;
  brands: BuildBrand[];
  total: number;
  rows: ApprovalRow[];
  command: Command | null;
}

/** One build per AU date. */
export function builds(s: ClientState): Build[] {
  const byDate = new Map<string, ApprovalRow[]>();
  for (const r of s.rows) {
    if (!r.log.built || !r.log.date) continue;
    byDate.set(r.log.date, [...(byDate.get(r.log.date) ?? []), r]);
  }
  const accounts = new Map((s.setup?.brands ?? []).filter((b) => b.confirmed).map((b) => [b.brand, b.account]));
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, rows]) => {
      const brands = new Map<string, BuildBrand>();
      for (const r of rows) {
        const b = brands.get(r.brand) ?? {
          brand: r.brand,
          account: accounts.get(r.brand) ?? null,
          campaign: r.campaign,
          adSet: r.adSet,
          adSetIds: [],
          adIds: [],
          rows: [],
          warnings: [],
        };
        if (r.log.adSetId && !b.adSetIds.includes(r.log.adSetId)) b.adSetIds.push(r.log.adSetId);
        if (r.log.adId) b.adIds.push(r.log.adId);
        b.rows.push(r.row);
        for (const w of r.log.warnings) b.warnings.push({ row: r.row, text: w });
        brands.set(r.brand, b);
      }
      const command =
        s.commands.find((c) => c.command === 'BUILD' && (c.finishedAt || c.startedAt || c.requestedAt).startsWith(date) && c.slackTs) ?? null;
      return { date, brands: [...brands.values()], total: rows.length, rows, command };
    });
}

export function adsManagerUrl(account: string | null, adIds: string[]): string | null {
  if (!account) return null;
  const act = account.replace(/^act_/, '');
  const ids = adIds.length ? `&selected_ad_ids=${adIds.join('%2C')}` : '';
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${act}${ids}`;
}

export function organizedCount(rows: ApprovalRow[]) {
  return rows.filter((r) => driveFolderId(r.drive)).length;
}

export function greeting(timeZone: string, d = new Date()): string {
  let h = 9;
  try {
    h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(d));
  } catch {}
  return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
}

export function longDate(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}
