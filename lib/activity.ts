import 'server-only';
import { a1 } from './columns.ts';
import { batchGet, getMeta } from './google.ts';
import { memo } from './cache.ts';

// Which campaigns / ad sets are live, judged from spend in RAW_META (Supermetrics).
// The app never talks to Meta, so "live" means "spent in the last LIVE_DAYS days of data".

export const LIVE_DAYS = 3;

export interface Activity {
  /** Latest date in RAW_META (YYYY-MM-DD); "live" is measured back from here. */
  asOf: string | null;
  campaigns: Map<string, string>; // name → last date with spend
  adSets: Map<string, string>; // "campaign|ad set" and "|ad set" → last date with spend
}

const EMPTY: Activity = { asOf: null, campaigns: new Map(), adSets: new Map() };

const num = (s: string) => Number(String(s ?? '').replace(/[$,\s]/g, '')) || 0;
const day = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '');

export async function metaActivity(sheetId: string): Promise<Activity> {
  return memo(`activity|${sheetId}`, 600_000, () => loadActivity(sheetId)).catch(() => EMPTY);
}

async function loadActivity(sheetId: string): Promise<Activity> {
  const meta = await getMeta(sheetId);
  if (!meta.tabs.some((t) => t.title === 'RAW_META')) return EMPTY;
  // Column order differs per client, so find them by header (row 4).
  const [[header = []]] = await batchGet(sheetId, [a1('RAW_META', 'A4:Z4')]);
  const find = (re: RegExp) => header.findIndex((h) => re.test(String(h).trim()));
  const cols = { date: find(/^date$/i), campaign: find(/^campaign( name)?$/i), adSet: find(/^ad set( name)?$/i), cost: find(/^(cost|amount spent|spend)/i) };
  if (Object.values(cols).some((i) => i < 0)) return EMPTY;
  const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));
  const [dates, camps, sets, costs] = await batchGet(
    sheetId,
    [cols.date, cols.campaign, cols.adSet, cols.cost].map((i) => a1('RAW_META', `${letter(i)}5:${letter(i)}`)),
  );

  const out: Activity = { asOf: null, campaigns: new Map(), adSets: new Map() };
  const bump = (m: Map<string, string>, k: string, d: string) => {
    if ((m.get(k) ?? '') < d) m.set(k, d);
  };
  for (let i = 0; i < dates.length; i++) {
    const d = day(String(dates[i]?.[0] ?? ''));
    if (!d) continue;
    if (!out.asOf || d > out.asOf) out.asOf = d;
    if (num(String(costs[i]?.[0] ?? '')) <= 0) continue;
    const c = String(camps[i]?.[0] ?? '').trim();
    const a = String(sets[i]?.[0] ?? '').trim();
    if (c) bump(out.campaigns, c, d);
    if (a) {
      bump(out.adSets, `${c}|${a}`, d);
      bump(out.adSets, `|${a}`, d);
    }
  }
  return out;
}

/** True when `last` is within LIVE_DAYS of the newest data. */
export function isLive(last: string | undefined, asOf: string | null): boolean {
  if (!last || !asOf) return false;
  return (Date.parse(asOf) - Date.parse(last)) / 86_400_000 < LIVE_DAYS;
}
