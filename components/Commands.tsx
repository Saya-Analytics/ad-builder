'use client';

import { useState, useTransition } from 'react';
import { sendCommand, nudgeCommand, type SendResult } from '@/app/actions';
import type { CommandType } from '@/lib/commands';
import { Icon } from './Icon';

/** What happened after a button asked Claude for something, with the manual fallback. */
export function CommandOutcome({ result, dark }: { result: SendResult; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!result.prompt) return;
    await navigator.clipboard.writeText(result.prompt).catch(() => {});
    setCopied(true);
  };
  let headline: string;
  if (!result.ok) headline = `Couldn’t send: ${result.error}`;
  else if (result.via === 'slack') headline = 'Sent to Claude in Slack. The result will show up here and in the sheet.';
  else headline = `Queued in the COMMANDS tab for Claude’s scheduled task.${result.slackError ? ` Slack post failed (${result.slackError}), so it went to the queue.` : ''}`;
  return (
    <div className={dark ? 'on-dark small' : 'notice small'} role="status" style={dark ? { display: 'flex', flexDirection: 'column', gap: 6 } : undefined}>
      <span>{headline}</span>
      {result.prompt && (!result.ok || result.via === 'sheet') ? (
        <span className="wrap" style={{ alignItems: 'center' }}>
          <button type="button" className="linkbtn" onClick={copy}>
            {copied ? 'Prompt copied ✓' : 'Copy prompt ›'}
          </button>
          {result.chatLink ? (
            <a href={result.chatLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginLeft: 12 }}>
              Open the Claude chat ›
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export function CommandButton({
  clientId,
  command,
  args = '',
  label,
  confirm,
  variant = 'link',
  dark,
}: {
  clientId: string;
  command: CommandType;
  args?: string;
  label: string;
  confirm?: string;
  variant?: 'primary' | 'outline' | 'link' | 'pill' | 'side';
  dark?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);
  const go = () => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => setResult(await sendCommand(clientId, command, args)));
  };
  const cls =
    variant === 'primary' ? 'btn' : variant === 'outline' ? 'btn btn-outline btn-sm' : variant === 'pill' ? 'pill' : variant === 'side' ? 'btn btn-sm' : 'linkbtn';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" className={cls} onClick={go} disabled={pending} style={variant === 'side' ? { width: '100%', margin: '6px 0 8px' } : undefined}>
        {variant === 'side' ? <Icon name="plus" size={16} stroke="#fff" width={2} /> : null}
        {pending ? 'Sending…' : label}
        {variant === 'link' && !pending ? ' ›' : ''}
      </button>
      {result ? <CommandOutcome result={result} dark={dark} /> : null}
    </div>
  );
}

export function NudgeButton({ clientId, commandId }: { clientId: string; commandId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="linkbtn" disabled={pending} onClick={() => start(async () => setResult(await nudgeCommand(clientId, commandId)))}>
        {pending ? 'Posting…' : 'Post the Slack tag again ›'}
      </button>
      {result ? <CommandOutcome result={result} /> : null}
    </div>
  );
}

export interface Suggestion {
  label: string;
  command: CommandType;
  args?: string;
}

/** The Ask Claude box. It never answers here: the answer arrives in Slack and in the sheet. */
export function AskClaude({ clientId, suggestions, example }: { clientId: string; suggestions: Suggestion[]; example: string }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);
  const send = (command: CommandType, args: string) =>
    start(async () => {
      const r = await sendCommand(clientId, command, args);
      setResult(r);
      if (r.ok && command === 'ASK') setText('');
    });
  return (
    <>
      <form
        className="askbox"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send('ASK', text.trim());
        }}
      >
        <label htmlFor="ask" className="sr">
          Ask Claude
        </label>
        <Icon name="spark" stroke="var(--accent)" />
        <input id="ask" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask Claude: “${example}”`} autoComplete="off" />
        <button type="submit" className="iconbtn" aria-label="Send to Claude" disabled={pending || !text.trim()}>
          <Icon name="send" stroke="#fff" width={2} />
        </button>
      </form>
      <div className="wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
        {suggestions.map((s) => (
          <button key={s.label} type="button" className="pill" style={{ minHeight: 40, padding: '8px 16px' }} disabled={pending} onClick={() => send(s.command, s.args ?? '')}>
            {s.label}
          </button>
        ))}
      </div>
      {pending ? <p className="small muted">Sending…</p> : null}
      {result ? (
        <div style={{ width: '100%', maxWidth: 760, textAlign: 'left' }}>
          <CommandOutcome result={result} />
        </div>
      ) : null}
    </>
  );
}
