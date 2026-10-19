'use server';

import { revalidatePath } from 'next/cache';
import { a1, ADDABLE_TABS, isWritableApprovalCol, REQUIRED_TABS, TABS } from '@/lib/columns';
import { addTab, appendValues, copyTabFrom, getMeta, GoogleError, serviceAccountEmail, updateValues } from '@/lib/google';
import { getClient, loadClients, loadClientState, masterSheetId, MASTER_TAB, todayIn } from '@/lib/data';
import { safeWrite, type WriteResult } from '@/lib/writes';
import { COMMAND_HEADER, COMMAND_TYPES, commandPrompt, newCommandId, type CommandType } from '@/lib/commands';
import { setupTemplate, setupValue } from '@/lib/setup';
import { postMessage, slackConfigured, todaysParent } from '@/lib/slack';
import { currentUser } from '@/lib/auth';

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/* ---------- cells ---------- */

/** AD APPROVALS: only B, Y and AO–AS. */
export async function writeApprovalCell(clientId: string, row: number, col: string, expected: string, value: string): Promise<WriteResult> {
  if (!isWritableApprovalCol(col)) return { ok: false, error: `Column ${col} is Claude’s or a formula. The app can’t write it.` };
  if (!Number.isInteger(row) || row < 6) return { ok: false, error: 'Bad row.' };
  const client = await getClient(clientId);
  if (!client) return { ok: false, error: 'Unknown client.' };
  try {
    const r = await safeWrite(client.sheetId, a1(TABS.approvals, `${col}${row}`), expected, value);
    if (r.ok) revalidatePath(`/c/${clientId}`, 'layout');
    return r;
  } catch (e) {
    return fail(e);
  }
}

/** CLAUDE SETUP: value column B only. */
export async function writeSetupCell(clientId: string, row: number, expected: string, value: string): Promise<WriteResult> {
  const client = await getClient(clientId);
  if (!client) return { ok: false, error: 'Unknown client.' };
  if (!Number.isInteger(row) || row < 4) return { ok: false, error: 'Bad row.' };
  try {
    const r = await safeWrite(client.sheetId, a1(TABS.setup, `B${row}`), expected, value);
    if (r.ok) revalidatePath(`/c/${clientId}`, 'layout');
    return r;
  } catch (e) {
    return fail(e);
  }
}

export async function addBrand(clientId: string, brand: string, account: string): Promise<WriteResult> {
  const client = await getClient(clientId);
  if (!client) return { ok: false, error: 'Unknown client.' };
  if (!brand.trim() || brand.trim().startsWith('=') || account.trim().startsWith('=')) return { ok: false, error: 'Enter a brand name.' };
  try {
    await appendValues(client.sheetId, a1(TABS.setup, 'A:B'), [[brand.trim(), account.trim()]]);
    revalidatePath(`/c/${clientId}`, 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- commands ---------- */

export interface SendResult {
  ok: boolean;
  id?: string;
  via?: 'slack' | 'sheet';
  slackError?: string;
  prompt?: string;
  chatLink?: string;
  error?: string;
}

function localMidnightEpoch(timeZone: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Math.floor(now.getTime() / 1000) - (n('hour') * 3600 + n('minute') * 60 + n('second'));
}

async function tagClaude(
  channel: string,
  clientName: string,
  timezone: string,
  prompt: string,
): Promise<{ ts: string; thread: string }> {
  const claude = process.env.CLAUDE_SLACK_USER_ID;
  if (!claude) throw new Error('CLAUDE_SLACK_USER_ID is not set');
  const parent = await todaysParent(channel, clientName, localMidnightEpoch(timezone)).catch(() => null);
  const ts = await postMessage(channel, `<@${claude}> ${prompt}`, parent ?? undefined);
  return { ts, thread: parent ?? ts };
}

/**
 * Leaves a command where Claude will see it. Slack tag first; the COMMANDS row is always
 * written so the app can track it. If Slack fails the row is queued for the scheduled task.
 */
export async function sendCommand(clientId: string, command: CommandType, args = ''): Promise<SendResult> {
  if (!(command in COMMAND_TYPES)) return { ok: false, error: 'Unknown command.' };
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const s = loaded.state;
  const by = await currentUser();
  const id = newCommandId();
  const clientName = setupValue(s.setup, 'clientName') || s.client.name;
  const skill = setupValue(s.setup, 'skill') || process.env.DEFAULT_SKILL || 'ad-builder';
  const prompt = commandPrompt({ skill, command, args: args.trim(), clientName, sheetId: s.client.sheetId, id });
  const chatLink = setupValue(s.setup, 'claudeChat') || undefined;
  const channel = setupValue(s.setup, 'slackChannelId');

  try {
    if (s.missingTabs.includes(TABS.commands)) await createCommandsTab(s.client.sheetId);
  } catch (e) {
    return { ...fail(e), prompt, chatLink };
  }

  let via: 'slack' | 'sheet' = 'sheet';
  let slackTs = '';
  let slackThread = '';
  let slackError: string | undefined;
  if (slackConfigured() && channel) {
    try {
      const r = await tagClaude(channel, clientName, s.timezone, prompt);
      via = 'slack';
      slackTs = r.ts;
      slackThread = r.thread;
    } catch (e) {
      slackError = e instanceof Error ? e.message : String(e);
    }
  } else {
    slackError = !channel ? 'No Slack channel in CLAUDE SETUP' : 'Slack is not configured';
  }

  try {
    await appendValues(s.client.sheetId, a1(TABS.commands, 'A:L'), [
      [
        id,
        new Date().toISOString(),
        command,
        args.trim(),
        by,
        via,
        via === 'slack' ? 'sent_to_slack' : 'queued',
        slackTs,
        '',
        '',
        slackError ? `Slack post failed: ${slackError}. Queued for the scheduled task.` : '',
        slackThread,
      ],
    ]);
  } catch (e) {
    return { ...fail(e), id, via, slackError, prompt, chatLink };
  }
  revalidatePath(`/c/${clientId}`, 'layout');
  return { ok: true, id, via, slackError, prompt, chatLink };
}

/** For a command Claude hasn't picked up: post the Slack tag again. Never rewrites the row. */
export async function nudgeCommand(clientId: string, commandId: string): Promise<SendResult> {
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const s = loaded.state;
  const c = s.commands.find((x) => x.id === commandId);
  if (!c) return { ok: false, error: 'Command not found.' };
  const clientName = setupValue(s.setup, 'clientName') || s.client.name;
  const skill = setupValue(s.setup, 'skill') || process.env.DEFAULT_SKILL || 'ad-builder';
  const prompt = commandPrompt({ skill, command: c.command, args: c.args, clientName, sheetId: s.client.sheetId, id: c.id });
  const chatLink = setupValue(s.setup, 'claudeChat') || undefined;
  const channel = setupValue(s.setup, 'slackChannelId');
  if (!slackConfigured() || !channel) return { ok: false, error: 'Slack is not set up for this client.', prompt, chatLink };
  try {
    await tagClaude(channel, clientName, s.timezone, prompt);
    return { ok: true, id: c.id, via: 'slack', prompt, chatLink };
  } catch (e) {
    return { ...fail(e), prompt, chatLink };
  }
}

/* ---------- clients ---------- */

async function createCommandsTab(sheetId: string) {
  await addTab(sheetId, TABS.commands);
  await updateValues(sheetId, a1(TABS.commands, 'A1:L1'), [[...COMMAND_HEADER]]);
}

async function addMissingTabs(sheetId: string, clientName: string, missing: string[]) {
  const template = process.env.TEMPLATE_SHEET_ID;
  for (const tab of missing) {
    if (template) {
      await copyTabFrom(template, tab, sheetId);
      if (tab === TABS.setup) await updateValues(sheetId, a1(TABS.setup, 'B4'), [[clientName]]);
    } else if (tab === TABS.commands) {
      await createCommandsTab(sheetId);
    } else if (tab === TABS.setup) {
      await addTab(sheetId, TABS.setup);
      const rows = setupTemplate(clientName, { skill: process.env.DEFAULT_SKILL ?? '', commandInterval: '60' });
      await updateValues(sheetId, a1(TABS.setup, `A1:B${rows.length}`), rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    }
  }
}

export interface ClientFormState {
  ok?: boolean;
  error?: string;
  clientId?: string;
  missingRequired?: string[];
  added?: string[];
}

const sheetIdFrom = (s: string) => s.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? (/^[\w-]{25,}$/.test(s.trim()) ? s.trim() : null);
const folderIdFrom = (s: string) => s.match(/\/folders\/([\w-]+)/)?.[1] ?? (/^[\w-]{20,}$/.test(s.trim()) ? s.trim() : null);
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

export async function addClient(_: ClientFormState, form: FormData): Promise<ClientFormState> {
  const name = String(form.get('name') ?? '').trim();
  const sheetId = sheetIdFrom(String(form.get('sheet') ?? ''));
  const driveId = folderIdFrom(String(form.get('drive') ?? ''));
  if (!name) return { error: 'Enter the client name.' };
  if (!sheetId) return { error: 'Paste the control sheet link (docs.google.com/spreadsheets/d/…).' };
  if (!driveId) return { error: 'Paste the Drive root folder link (drive.google.com/drive/folders/…).' };

  try {
    const clients = await loadClients();
    if (clients.some((c) => c.sheetId === sheetId)) return { error: 'That control sheet is already in the master sheet.' };
    let id = slug(name) || 'client';
    for (let i = 2; clients.some((c) => c.id === id); i++) id = `${slug(name)}-${i}`;

    let meta;
    try {
      meta = await getMeta(sheetId);
    } catch (e) {
      if (e instanceof GoogleError && [401, 403, 404].includes(e.status))
        return { error: `Can’t read that sheet. Share it with ${serviceAccountEmail()} (Editor) and try again.` };
      throw e;
    }
    const tabs = new Set(meta.tabs.map((t) => t.title));
    const missingRequired = REQUIRED_TABS.filter((t) => !tabs.has(t));
    const toAdd = ADDABLE_TABS.filter((t) => !tabs.has(t));
    await addMissingTabs(sheetId, name, toAdd);

    await appendValues(masterSheetId(), a1(MASTER_TAB, 'A:G'), [[id, name, sheetId, driveId, 'Active', todayIn(process.env.DEFAULT_TIMEZONE ?? 'UTC'), '']]);
    revalidatePath('/', 'layout');
    return { ok: true, clientId: id, missingRequired, added: toAdd };
  } catch (e) {
    return fail(e);
  }
}

/** Adds CLAUDE SETUP / COMMANDS to an existing client that is missing them. */
export async function repairTabs(clientId: string): Promise<{ ok: boolean; error?: string; added?: string[] }> {
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const toAdd = ADDABLE_TABS.filter((t) => loaded.state.missingTabs.includes(t));
  try {
    await addMissingTabs(loaded.state.client.sheetId, loaded.state.client.name, toAdd);
    revalidatePath('/', 'layout');
    return { ok: true, added: toAdd };
  } catch (e) {
    return fail(e);
  }
}

/** Marks the client Offboarded. Never touches its sheet, Drive or Ads Manager. */
export async function offboardClient(clientId: string): Promise<WriteResult> {
  const client = await getClient(clientId);
  if (!client) return { ok: false, error: 'Unknown client.' };
  try {
    const sheet = masterSheetId();
    const current = (await loadClients()).find((c) => c.id === clientId)!;
    const r = await safeWrite(sheet, a1(MASTER_TAB, `E${current.row}`), current.statusRaw, 'Offboarded');
    if (!r.ok) return r;
    await updateValues(sheet, a1(MASTER_TAB, `G${current.row}`), [[todayIn(process.env.DEFAULT_TIMEZONE ?? 'UTC')]]);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
