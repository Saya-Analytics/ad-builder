import 'server-only';
import { memo } from './cache.ts';

// Slack Web API, bot token with chat:write + channels:history.
// The app only posts command tags and reads threads; Claude does all the reporting.

export interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  bot_id?: string;
}

const token = () => process.env.SLACK_BOT_TOKEN ?? '';
export const slackConfigured = () => !!token() && !process.env.FAKE_SHEETS_FILE;

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!json.ok) throw new Error(`Slack ${method}: ${json.error ?? res.status}`);
  return json;
}

export async function slackOk(): Promise<boolean> {
  if (!slackConfigured()) return false;
  return memo('slack-ok', 300_000, async () => {
    try {
      await call('auth.test', {});
      return true;
    } catch {
      return false;
    }
  });
}

export async function postMessage(channel: string, text: string, threadTs?: string): Promise<string> {
  const r = await call<{ ts: string }>('chat.postMessage', { channel, text, thread_ts: threadTs || undefined, unfurl_links: false });
  return r.ts;
}

export async function threadReplies(channel: string, ts: string): Promise<SlackMessage[]> {
  if (!slackConfigured()) return [];
  const r = await call<{ messages: SlackMessage[] }>('conversations.replies', { channel, ts, limit: 50 });
  return r.messages;
}

/**
 * The skill posts one parent per client per day: "*ASHTEL STUDIOS · Building · Thu, Oct 16*".
 * The app posts its tags under today's parent when there is one, otherwise in the channel.
 */
export async function todaysParent(channel: string, clientName: string, sinceEpochSeconds: number): Promise<string | null> {
  const r = await call<{ messages: SlackMessage[] }>('conversations.history', { channel, oldest: String(sinceEpochSeconds), limit: 100 });
  const head = `*${clientName.toUpperCase()} ·`;
  return r.messages.find((m) => m.text?.startsWith(head))?.ts ?? null;
}

export function permalink(channel: string, ts: string, threadTs?: string): string {
  const base = (process.env.SLACK_WORKSPACE_URL ?? 'https://slack.com').replace(/\/$/, '');
  const p = `${base}/archives/${channel}/p${ts.replace('.', '')}`;
  return threadTs && threadTs !== ts ? `${p}?thread_ts=${threadTs}&cid=${channel}` : p;
}

/** Slack mrkdwn → plain text good enough for a status line. */
export function plain(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, '')
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}
