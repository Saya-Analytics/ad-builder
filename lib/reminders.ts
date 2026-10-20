// The skill's hard rules, repeated in every message the app leaves for Claude (Slack tag,
// COMMANDS prompt, the prompt people paste by hand). The skill has the full detail; this is
// the checklist Claude must not skip, whichever way the request reaches it.

const ALWAYS = [
  'Read CLAUDE SETUP and the COMMANDS row first, and follow the skill’s rules for this mode.',
  'Check the ad account: each brand (AF) must map to exactly one act_ in CLAUDE SETUP, and that account’s name must match the brand. If not, skip that brand and ask in Slack.',
  'Everything you create is PAUSED. Never turn anything on, never delete, never change budgets on live ads.',
  'Re-read the rows before writing. Never write formula columns (C, D, E, G–U, W, AE, AT). Never overwrite what a person typed.',
  'Destinations (AO–AQ): look them up live in Ads Manager, all statuses, exact names. USE creates nothing; CREATE creates exactly that, once. Never guess.',
  'Drive: Z must be the creative’s own folder; real pixel dimensions, never the filename. Never trash or overwrite a file.',
  'Rows sharing one Drive link (e.g. 81, 82, 83): organize the folder FIRST, then one row per creative: reuse those rows in order, insert rows for extra creatives (formulas copied from the row above), report leftover rows. The row count means nothing.',
  'Empty Y (URL): after analyzing the creative, find the matching product/collection page on the brand’s site and write it in Y; if unsure, use the homepage. Never change a filled Y. Log Y_PROPOSED in AU and list it in the review.',
  'If Z is only digits, it’s a creator’s post ID: build a PARTNERSHIP ad on that post (check partnership permissions first), not a Drive upload.',
  'Anything a person must do or decide: ask in the Slack thread, tagged (CLAUDE SETUP tags), with the exact rows and cells, and say it in this chat too. Don’t stall the other rows.',
  'Finish: update this command’s COMMANDS row (G, I, J, K) and post the result in today’s Slack thread for the client.',
];

const COPY = [
  'Copy: research first: live and top ads in the ad account through AdManage (list_ads, get_top_ads, get_source_ad_setup), then the COPY tab and the brand’s past rows in AD APPROVALS.',
  'Copy: open the landing page (Y) and the brand’s site. Only say what is on that page or in the creative: no invented prices, discounts, results, guarantees, shipping or “#1”. List anything you left out.',
  'Copy: always analyze the creative AND read the row’s 📝 COPY NOTES (AV). Blank AV = write from the creative alone.',
  'Destination: AR is the ad set whose settings get copied (only when creating). AS budget only when creating; blank or ignored on CBO campaigns.',
  'Copy: write it into the COPY tab, set F, build PAUSED, then send the copy for review (Slack thread + this chat): “Review the copy for rows …, reply OK or tell me what to change.” Nothing gets turned on before that OK.',
];

const BY_COMMAND: Record<string, string[]> = {
  BUILD: ['Build only the rows listed (if any), and follow the team’s note within these rules.', ...COPY],
  REWRITE_COPY: ['Write a NEW COPY row and point F at it; never edit the old one. Nothing in Ads Manager.', ...COPY],
  CHECK: ['Daily check: look up only, never create anything in Ads Manager.'],
  FIX_ROWS: ['Fix only what the sheet or Drive makes clear. Never guess a destination or URL; create nothing in Ads Manager.'],
  RECHECK_BUILD: ['Re-check only: confirm each ad exists and is PAUSED, fix the log. Create nothing.'],
  STATUS: [],
  ASK: ['If it asks for something outside the skill (turn on, delete, change spend), don’t: mark it failed with the reason.', ...COPY],
};

export function reminders(command: string): string[] {
  return [...ALWAYS, ...(BY_COMMAND[command] ?? [])];
}

export function remindersBlock(command: string): string {
  return ['Remember (hard rules of the skill):', ...reminders(command).map((r) => `• ${r}`)].join('\n');
}
