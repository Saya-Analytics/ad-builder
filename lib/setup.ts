// CLAUDE SETUP tab: label in A, value (yellow cell) in B. The skill reads 'CLAUDE SETUP'!A1:B60
// by label, so the app does the same and never depends on fixed row numbers.

export const SETUP_RANGE = 'A1:B60';

export const SETUP_FIELDS = {
  clientName: 'Client name',
  buildDay: 'Build day',
  timezone: 'Timezone',
  afterBuildStatus: 'Status after Claude builds',
  slackChannelId: 'Slack channel ID',
  slackTags: 'Tag on roadblocks',
  claudeChat: 'Claude chat to reply in',
  skill: 'Skill',
  commandInterval: 'Command check interval (minutes)',
} as const;

export type SetupKey = keyof typeof SETUP_FIELDS;

export const SETUP_HINTS: Record<SetupKey, string> = {
  clientName: 'Used in Slack headers and reports',
  buildDay: 'Weekday Claude runs BUILD. Other days run DAILY CHECK.',
  timezone: 'IANA name, e.g. America/Bogota',
  afterBuildStatus: 'Claude sets column B to this after a successful build',
  slackChannelId: 'e.g. C0C9S4EKJ3E',
  slackTags: 'Mentions on every roadblock, e.g. <@U0C24G9D2EP>',
  claudeChat: 'Link to the client’s Claude chat (manual fallback)',
  skill: 'Skill Claude runs for this client',
  commandInterval: 'How often Claude’s scheduled task reads COMMANDS',
};

export const BRANDS_HEADER = 'META AD ACCOUNTS';

export interface SetupCell {
  row: number;
  value: string;
}

export interface BrandAccount {
  row: number;
  brand: string;
  account: string;
  /** Exactly one act_ id. Anything else ("act_1 or act_2", blank) is a blocker. */
  confirmed: boolean;
  candidates: string[];
}

export interface Setup {
  fields: Partial<Record<SetupKey, SetupCell>>;
  brands: BrandAccount[];
}

export function parseSetup(values: string[][]): Setup {
  const byLabel = new Map<string, SetupKey>(
    Object.entries(SETUP_FIELDS).map(([k, label]) => [label.toLowerCase(), k as SetupKey]),
  );
  const fields: Setup['fields'] = {};
  const brands: BrandAccount[] = [];
  let inBrands = false;
  values.forEach((r, i) => {
    const label = (r[0] ?? '').toString().trim();
    const value = (r[1] ?? '').toString().trim();
    const row = i + 1;
    if (!label) return;
    if (label.toUpperCase() === BRANDS_HEADER) {
      inBrands = true;
      return;
    }
    const key = byLabel.get(label.toLowerCase());
    if (key) {
      fields[key] = { row, value };
      inBrands = false;
      return;
    }
    if (inBrands) {
      const candidates = value.match(/act_\d+/g) ?? [];
      brands.push({ row, brand: label, account: value, candidates, confirmed: candidates.length === 1 && /^act_\d+$/.test(value) });
    }
  });
  return { fields, brands };
}

export const setupValue = (s: Setup | null, k: SetupKey) => s?.fields[k]?.value ?? '';

/** Rows for a fresh CLAUDE SETUP tab (used when there is no template sheet). */
export function setupTemplate(clientName: string, defaults: Partial<Record<SetupKey, string>> = {}): string[][] {
  const rows: string[][] = [
    ['CLAUDE SETUP'],
    ['Yellow cells are settings. Claude (the ad-builder skill) and the Ad Builder app both read this tab by label.'],
    ['SETTING', 'VALUE'],
  ];
  for (const [k, label] of Object.entries(SETUP_FIELDS) as [SetupKey, string][]) {
    rows.push([label, k === 'clientName' ? clientName : defaults[k] ?? '']);
  }
  rows.push([], [BRANDS_HEADER, 'Brand (exactly as in AF) → act_…']);
  return rows;
}

/** What every new client starts with. Change these in the Vercel environment. */
export function onboardingDefaults(): Partial<Record<SetupKey, string>> {
  const env = process.env;
  return {
    buildDay: env.DEFAULT_BUILD_DAY ?? 'Thursday',
    timezone: env.DEFAULT_TIMEZONE ?? 'America/Los_Angeles',
    afterBuildStatus: env.DEFAULT_AFTER_BUILD_STATUS ?? 'Paused',
    slackChannelId: env.DEFAULT_SLACK_CHANNEL_ID ?? '',
    slackTags: env.DEFAULT_SLACK_TAGS ?? '',
    commandInterval: env.DEFAULT_COMMAND_INTERVAL ?? '60',
  };
}

/** "Brand | act_123" lines → pairs. A line with only an act_ id gets the brand `fallbackBrand`. */
export function parseBrandLines(text: string, fallbackBrand: string): { brand: string; account: string }[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.split(/\s*[|,;\t]\s*/);
      if (b === undefined && /^act_\d+$/.test(a)) return { brand: fallbackBrand, account: a };
      return { brand: a, account: b ?? '' };
    })
    .filter((x) => x.brand);
}
