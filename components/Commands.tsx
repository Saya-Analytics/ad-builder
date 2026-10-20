'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendCommand, nudgeCommand, type SendResult } from '@/app/actions';
import type { CommandType } from '@/lib/commands';
import { Icon } from './Icon';

function ClaudeChatButton({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm btn-claude" style={{ alignSelf: 'flex-start', color: '#fff' }}>
      Open the Claude session ›
    </a>
  );
}

/** What happened after a button asked Claude for something, with the manual fallback. */
export function CommandOutcome({ result, dark }: { result: SendResult; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  // Re-read so the red badge on "Claude session" and the requests list show the new command.
  useEffect(() => {
    if (result.ok) router.refresh();
  }, [result, router]);
  const copy = async () => {
    if (!result.prompt) return;
    await navigator.clipboard.writeText(result.prompt).catch(() => {});
    setCopied(true);
  };
  const when = !result.intervalMinutes ? 'on its next run' : result.intervalMinutes >= 1440 ? 'on its next daily run' : `within ${result.intervalMinutes} minutes`;
  if (!result.ok) {
    return (
      <div className={dark ? 'on-dark small' : 'notice small'} role="alert">
        <span>Couldn’t send it to Claude: {result.error}</span>
      </div>
    );
  }
  if (result.via === 'slack') {
    return (
      <div className={dark ? 'on-dark small' : 'notice small'} role="status">
        <strong>Sent to Claude in Slack ✓</strong>
        <span>Claude replies in the thread; the result shows up here and in the sheet.</span>
        {result.chatLink ? <ClaudeChatButton href={result.chatLink} /> : null}
      </div>
    );
  }
  return (
    <div className={dark ? 'on-dark small' : 'notice small'} role="status" style={dark ? { display: 'flex', flexDirection: 'column', gap: 6 } : undefined}>
      <strong>Sent to Claude ✓</strong>
      <span>
        It’s in the COMMANDS tab. Claude’s scheduled task picks it up {when} and writes the result back here.
        {result.slackError ? ' (Slack didn’t answer, so it went to the queue.)' : ''}
      </span>
      <span>Want it now? Paste the prompt in the client’s Claude chat.</span>
      <span className="wrap" style={{ alignItems: 'center', gap: 16 }}>
        <button type="button" className="linkbtn" onClick={copy}>
          {copied ? 'Prompt copied ✓' : 'Copy prompt ›'}
        </button>
        {result.chatLink ? (
          <ClaudeChatButton href={result.chatLink} />
        ) : (
          <span className="muted">Add the Claude chat link in Settings to open it from here.</span>
        )}
      </span>
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
export function AskClaude({ clientId, suggestions, example, children }: { clientId: string; suggestions: Suggestion[]; example: string; children?: React.ReactNode }) {
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
        {children}
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
