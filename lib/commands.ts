// COMMANDS tab: the queue between the app and Claude. The app only appends rows;
// Claude moves status queued/sent_to_slack → running → done | failed and writes the note.

export const COMMAND_HEADER = [
  'command_id',
  'requested_at',
  'command',
  'args',
  'by',
  'via',
  'status',
  'slack_ts',
  'started_at',
  'finished_at',
  'note',
  'slack_thread',
] as const;

export const COMMAND_TYPES = {
  BUILD: 'Build every ready row (BUILD mode)',
  CHECK: 'Run the daily check (DAILY CHECK mode)',
  REWRITE_COPY: 'Write new copy for the rows in args',
  RECHECK_BUILD: 'Re-check a finished build and fix the log',
  STATUS: 'Post today’s status to the Slack thread',
  ASK: 'Free-text request in args',
} as const;

export type CommandType = keyof typeof COMMAND_TYPES;
export type CommandStatus = 'queued' | 'sent_to_slack' | 'running' | 'done' | 'failed';

export interface Command {
  row: number;
  id: string;
  requestedAt: string;
  command: string;
  args: string;
  by: string;
  via: string;
  status: CommandStatus | string;
  slackTs: string;
  startedAt: string;
  finishedAt: string;
  note: string;
  slackThread: string;
}

export function parseCommands(values: string[][]): Command[] {
  // values start at row 2 (row 1 is the header)
  return values
    .map((r, i) => {
      const c = (j: number) => (r[j] ?? '').toString().trim();
      return {
        row: i + 2,
        id: c(0),
        requestedAt: c(1),
        command: c(2),
        args: c(3),
        by: c(4),
        via: c(5),
        status: c(6).toLowerCase(),
        slackTs: c(7),
        startedAt: c(8),
        finishedAt: c(9),
        note: c(10),
        slackThread: c(11),
      };
    })
    .filter((c) => c.id);
}

export const isOpen = (c: Command) => c.status === 'queued' || c.status === 'sent_to_slack' || c.status === 'running';

export function newCommandId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `CMD-${stamp}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/** The exact prompt Claude gets, in Slack or pasted by hand. */
export function commandPrompt(opts: {
  skill: string;
  command: string;
  args: string;
  clientName: string;
  sheetId: string;
  id: string;
}): string {
  const sheet = `https://docs.google.com/spreadsheets/d/${opts.sheetId}`;
  const args = opts.args ? `: ${opts.args}` : '';
  return `run ${opts.skill} ${opts.command} for ${opts.clientName}, sheet ${sheet}${args} · command ${opts.id} (update its row in the COMMANDS tab)`;
}

/** Queued for longer than the schedule interval (plus 10 min grace). */
export function isStale(c: Command, intervalMinutes: number, now = Date.now()): boolean {
  if (c.status !== 'queued' && c.status !== 'sent_to_slack') return false;
  const t = Date.parse(c.requestedAt);
  return Number.isFinite(t) && now - t > (intervalMinutes + 10) * 60_000;
}
