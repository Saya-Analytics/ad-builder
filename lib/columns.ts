// Layout of a client control sheet. Mirrors section 1 of the ad-builder skill,
// so the app and Claude read the same cells the same way.

export const TABS = {
  approvals: 'AD APPROVALS',
  copy: 'COPY',
  hooks: 'HOOKS',
  setup: 'CLAUDE SETUP',
  commands: 'COMMANDS',
} as const;

/** Tabs the app cannot create: they hold the team's work. */
export const REQUIRED_TABS = [TABS.approvals, TABS.copy, TABS.hooks] as const;
/** Tabs the app adds from the template when missing. */
export const ADDABLE_TABS = [TABS.setup, TABS.commands] as const;

export const APPROVALS_HEADER_ROW = 4;
/** Row 5 is the EXAMPLE row. */
export const APPROVALS_FIRST_ROW = 6;
export const APPROVALS_LAST_COL = 'AV'; // AV = 📝 COPY NOTES (optional, may be missing on older sheets)

export const COPY_FIRST_ROW = 6;
export const HOOKS_FIRST_ROW = 6;

/** The only AD APPROVALS columns the app may write. Z is the Drive link people paste (Claude updates it after organizing). */
export const WRITABLE_APPROVAL_COLS = ['B', 'Y', 'Z', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AV'] as const;
export type WritableApprovalCol = (typeof WRITABLE_APPROVAL_COLS)[number];

export const STATUS_BUILDING = 'Building in ads manager';

export function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

export function a1(tab: string, range: string): string {
  return `${quoteTab(tab)}!${range}`;
}

export function isWritableApprovalCol(col: string): col is WritableApprovalCol {
  return (WRITABLE_APPROVAL_COLS as readonly string[]).includes(col);
}
