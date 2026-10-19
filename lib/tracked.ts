import 'server-only';
import { isStale } from './commands.ts';
import { setupValue } from './setup.ts';
import { permalink, plain, threadReplies } from './slack.ts';
import type { ClientState } from './data.ts';
import type { TrackedCommand } from '@/components/CommandTracker';

export function commandInterval(s: ClientState): number {
  const n = Number(setupValue(s.setup, 'commandInterval'));
  return Number.isFinite(n) && n > 0 ? n : Number(process.env.DEFAULT_COMMAND_INTERVAL ?? 60);
}

/** Newest first. For open Slack commands, adds Claude's latest reply in the thread. */
export async function trackedCommands(s: ClientState, limit = 20): Promise<TrackedCommand[]> {
  const channel = setupValue(s.setup, 'slackChannelId');
  const interval = commandInterval(s);
  const list = [...s.commands].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).slice(0, limit);
  return Promise.all(
    list.map(async (c) => {
      let lastReply: string | null = null;
      const thread = c.slackThread || c.slackTs;
      if (channel && thread && c.slackTs && (c.status === 'sent_to_slack' || c.status === 'running')) {
        const replies = await threadReplies(channel, thread).catch(() => []);
        const after = replies.filter((m) => Number(m.ts) > Number(c.slackTs));
        const last = after[after.length - 1];
        lastReply = last ? plain(last.text).slice(0, 240) : null;
      }
      return {
        id: c.id,
        command: c.command,
        args: c.args,
        by: c.by,
        via: c.via,
        status: c.status,
        requestedAt: c.requestedAt,
        finishedAt: c.finishedAt,
        note: c.note,
        stale: isStale(c, interval),
        slackLink: channel && c.slackTs ? permalink(channel, c.slackTs, thread) : null,
        lastReply,
      };
    }),
  );
}
