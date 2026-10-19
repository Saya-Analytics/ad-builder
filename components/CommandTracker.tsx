'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NudgeButton } from './Commands';

export interface TrackedCommand {
  id: string;
  command: string;
  args: string;
  by: string;
  via: string;
  status: string;
  requestedAt: string;
  finishedAt: string;
  note: string;
  stale: boolean;
  slackLink: string | null;
  lastReply: string | null;
}

const POLL_MS = 30_000;
const OPEN = new Set(['queued', 'sent_to_slack', 'running']);
const LABEL: Record<string, string> = {
  queued: 'Queued',
  sent_to_slack: 'Sent in Slack',
  running: 'Claude is on it',
  done: 'Done',
  failed: 'Failed',
};

function when(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Re-reads COMMANDS (and the Slack thread) every 30 s while anything is open,
 * and refreshes the page when a command finishes so the sheet data is current.
 */
export function CommandTracker({ clientId, initial, limit = 5, chatLink }: { clientId: string; initial: TrackedCommand[]; limit?: number; chatLink?: string }) {
  const [items, setItems] = useState(initial);
  const router = useRouter();
  const prevOpen = useRef(new Set(initial.filter((c) => OPEN.has(c.status)).map((c) => c.id)));

  useEffect(() => setItems(initial), [initial]);

  const anyOpen = items.some((c) => OPEN.has(c.status));
  useEffect(() => {
    if (!anyOpen) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/c/${clientId}/commands`, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const next = ((await res.json()) as { commands: TrackedCommand[] }).commands;
      setItems(next);
      const closed = next.some((c) => prevOpen.current.has(c.id) && !OPEN.has(c.status));
      prevOpen.current = new Set(next.filter((c) => OPEN.has(c.status)).map((c) => c.id));
      if (closed) router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [anyOpen, clientId, router]);

  const shown = items.slice(0, limit);
  if (!shown.length) return <p className="small muted">No commands yet. Anything you ask Claude shows up here.</p>;
  return (
    <div>
      {shown.map((c) => (
        <div key={c.id} id={c.id} className="line">
          <span className={`mark ${c.status === 'done' ? 'mark-done' : c.status === 'failed' ? 'mark-att' : 'mark-todo'}`} aria-hidden="true">
            {c.status === 'done' ? '✓' : c.status === 'failed' ? '!' : '…'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row-between">
              <span className="strong">
                {c.command}
                {c.args ? <span className="muted" style={{ fontWeight: 400 }}> · {c.args}</span> : null}
              </span>
              <span className="small muted">
                {LABEL[c.status] ?? c.status} · {when(c.finishedAt || c.requestedAt)}
              </span>
            </div>
            <div className="small" style={{ color: 'var(--secondary)' }}>
              {c.note || (c.lastReply ? `Slack: ${c.lastReply}` : `By ${c.by} via ${c.via === 'slack' ? 'Slack' : 'the COMMANDS tab'}`)}
            </div>
            {c.stale ? (
              <div className="small" style={{ marginTop: 6 }}>
                <strong>Claude hasn’t picked this up yet.</strong>
                <div className="wrap" style={{ alignItems: 'center', gap: 16 }}>
                  <NudgeButton clientId={clientId} commandId={c.id} />
                  {chatLink ? (
                    <a href={chatLink} target="_blank" rel="noreferrer">
                      Open the Claude chat ›
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
            {c.slackLink ? (
              <a className="small" href={c.slackLink} target="_blank" rel="noreferrer">
                Slack thread ›
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
