import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalsLayoutIssue, parseApprovals, parseBuildLog, parseCopy, rowRanges, rowStatus, pipelineSteps } from './approvals.ts';
import { parseSetup } from './setup.ts';
import { isStale, parseCommands } from './commands.ts';
import { colToIndex, indexToCol } from './columns.ts';

function row(cells: Record<string, string>): string[] {
  const r: string[] = [];
  for (const [col, v] of Object.entries(cells)) r[colToIndex(col)] = v;
  return Array.from(r, (v) => v ?? '');
}

const READY = {
  B: 'Building in ads manager',
  AF: 'EVO',
  F: 'CP007 · Marvel · Coolest on the Counter',
  V: 'H006 · The coolest thing on my counter!',
  Y: 'https://getevo.net/products/irm-1',
  Z: 'https://drive.google.com/drive/folders/1HV7Fx6xLvr3PMUaN89iymk9oKs41PcZ1',
  AO: 'CREATE NEW AD SET',
  AP: '[MM][Prospecting] ADV+ | Toothbrushes',
  AQ: 'MM_PROSPECTING_NEWBRIEFS',
  AT: '✓ Ready · Claude will CREATE ad set ③ in campaign ②',
};
const copy = new Map(parseCopy([row({ A: 'CP007', B: 'Marvel · Coolest on the Counter', C: 'EVO', E: 'Active', K: 'The Coolest Thing on Your Counter' })]).map((c) => [c.code, c]));

test('columns round-trip', () => {
  for (const c of ['A', 'Z', 'AA', 'AU', 'AZ', 'BA']) assert.equal(indexToCol(colToIndex(c)), c);
  assert.equal(colToIndex('AU'), 46);
});

test('parses every AU shape Claude writes', () => {
  const a = parseBuildLog('BUILT | AD 120261042311070059 | PAUSED | 2026-10-16 | ⚠ video Iron Man, URL Black Panther');
  assert.equal(a.built, true);
  assert.equal(a.adId, '120261042311070059');
  assert.equal(a.date, '2026-10-16');
  assert.deepEqual(a.warnings, ['video Iron Man, URL Black Panther']);

  const b = parseBuildLog('ADSET_CREATED 120261042138390059 | AD 120261042311290059 | PAUSED | 2026-10-16');
  assert.equal(b.built, true);
  assert.equal(b.adSetId, '120261042138390059');
  assert.equal(b.adId, '120261042311290059');

  const c = parseBuildLog('CAMPAIGN_CREATED:111111111 | ADSET_CREATED:222222222 | AD_ID:333333333 | 2026-10-20 | ok');
  assert.deepEqual([c.built, c.campaignId, c.adSetId, c.adId], [true, '111111111', '222222222', '333333333']);

  const d = parseBuildLog('FAILED: Meta error 10');
  assert.deepEqual([d.built, d.failed], [false, 'Meta error 10']);

  const e = parseBuildLog('ORGANIZED:2 creatives | dims:9x16 | 2026-10-14');
  assert.deepEqual([e.built, e.organized], [false, '2 creatives']);
});

test('skips section labels and the EXAMPLE row', () => {
  const rows = parseApprovals([row({ A: 'New August Creatives - EVO' }), row({ B: 'EXAMPLE' }), row(READY)], 6);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].row, 8);
});

test('ready / fix / built', () => {
  const [ready] = parseApprovals([row(READY)]);
  assert.equal(rowStatus(ready, copy).state, 'ready');

  const [noDest] = parseApprovals([row({ ...READY, AP: '', AQ: '' })]);
  const s = rowStatus(noDest, copy);
  assert.equal(s.state, 'fix');
  assert.deepEqual(s.problems[0].cols, ['AP', 'AQ']);

  const [atFail] = parseApprovals([row({ ...READY, AT: '✗ Fill Y (website URL)' })]);
  assert.equal(rowStatus(atFail, copy).problems[0].title, 'Fill Y (website URL)');

  const [noF] = parseApprovals([row({ ...READY, F: '' })]);
  assert.equal(rowStatus(noF, copy).state, 'ready', 'F empty is fine: Claude writes it');

  const [notDrive] = parseApprovals([row({ ...READY, Z: 'https://acme.sharepoint.com/x' })]);
  assert.equal(rowStatus(notDrive, copy).problems[0].title, 'Assets not in Drive');

  const [built] = parseApprovals([row({ ...READY, AU: 'BUILT | AD 1202610423 | PAUSED | 2026-10-16' })]);
  assert.equal(rowStatus(built, copy).state, 'built');

  const [warned] = parseApprovals([row({ ...READY, AU: 'BUILT | AD 1202610423 | PAUSED | 2026-10-16 | ⚠ video Iron Man, URL Black Panther' })]);
  assert.equal(rowStatus(warned, copy).state, 'fix');
});

test('pipeline has 7 steps', () => {
  const [r] = parseApprovals([row(READY)]);
  const steps = pipelineSteps(r, copy);
  assert.equal(steps.length, 7);
  assert.equal(steps[2].done, true);
  assert.equal(steps[5].done, false);
});

test('CLAUDE SETUP by label, brands block, unconfirmed account', () => {
  const s = parseSetup([
    ['CLAUDE SETUP'],
    [''],
    ['SETTING', 'VALUE'],
    ['Client name', 'Ashtel Studios'],
    ['Build day', 'Thursday'],
    ['Status after Claude builds', ''],
    [],
    ['META AD ACCOUNTS', 'Brand → act_'],
    ['EVO', 'act_970523986836813'],
    ['Smart Care US', 'act_887644237727522 or act_1747646876235061'],
  ]);
  assert.equal(s.fields.clientName?.value, 'Ashtel Studios');
  assert.equal(s.fields.buildDay?.row, 5);
  assert.equal(s.brands.length, 2);
  assert.equal(s.brands[0].confirmed, true);
  assert.equal(s.brands[1].confirmed, false);
  assert.equal(s.brands[1].candidates.length, 2);
});

test('stale commands', () => {
  const [c] = parseCommands([['CMD-1', '2026-10-19T10:00:00Z', 'BUILD', '', 'me', 'sheet', 'queued']]);
  assert.equal(isStale(c, 60, Date.parse('2026-10-19T10:30:00Z')), false);
  assert.equal(isStale(c, 60, Date.parse('2026-10-19T11:30:00Z')), true);
});

test('row ranges', () => {
  assert.equal(rowRanges([118, 113, 114, 115, 120]), '113–115, 118, 120');
});

test('old AD APPROVALS layout is detected', () => {
  const header = row({ F: 'COPY SET', AO: '① WHAT DOES CLAUDE DO?', AU: 'BUILD LOG' });
  assert.equal(approvalsLayoutIssue(header), null);
  const legacy = ['PREVIEW', 'STATUS', 'Brand', 'AD Name', 'Headline', 'Primary Text', 'Description'];
  assert.match(approvalsLayoutIssue(legacy) ?? '', /old layout \(7 columns/);
});

test('a creator post ID in Z is a partnership ad, not a Drive problem', () => {
  const [r] = parseApprovals([row({ ...READY, Z: '17890123456789012', AT: '✗ Z · paste the Google Drive folder link' })], 6);
  assert.equal(rowStatus(r, copy).state, 'ready');
  assert.equal(pipelineSteps(r, copy)[0].done, true);
  const [bad] = parseApprovals([row({ ...READY, Z: 'see brief' })], 6);
  assert.equal(rowStatus(bad, copy).state, 'fix');
});

test('every prompt carries the hard rules', async () => {
  const { commandPrompt } = await import('./commands.ts');
  const p = commandPrompt({ skill: 's', command: 'BUILD', args: 'rows 6', clientName: 'X', sheetId: 'id', id: 'CMD-1' });
  assert.match(p, /Remember \(hard rules/);
  assert.match(p, /ad account/);
  assert.match(p, /landing page/);
  assert.match(p, /PARTNERSHIP/);
});

test('an empty URL does not block: Claude proposes one', () => {
  const [r] = parseApprovals([row({ ...READY, Y: '', AT: '✗ Y · paste the website URL' })], 6);
  assert.equal(rowStatus(r, copy).state, 'ready');
  const [z] = parseApprovals([row({ ...READY, Y: '', Z: 'see brief', AT: '✗ Y · paste the website URL' })], 6);
  assert.equal(rowStatus(z, copy).state, 'fix');
});
