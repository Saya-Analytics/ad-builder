'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Straight to this client's Claude chat. Clicking also copies a "process the COMMANDS tab"
 * prompt, because Claude in the chat only works when it gets a message (or a scheduled run).
 * The red badge counts requests Claude hasn't finished.
 */
export function ClaudeSessionLink({ href, open, settings, prompt }: { href: string | null; open: number; settings: string; prompt: string }) {
  const [copied, setCopied] = useState(false);
  const badge = open ? (
    <span className="badge-red" aria-label={`${open} request${open === 1 ? '' : 's'} waiting on Claude`}>
      {open}
    </span>
  ) : null;
  if (!href)
    return (
      <Link prefetch={false} href={settings} className="navbtn" title="Add the Claude chat link in Settings">
        <Icon name="spark" /> Claude session
        {badge ?? <span className="note">add link</span>}
      </Link>
    );
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="navbtn"
      title="Copies the prompt and opens this client’s Claude chat: paste it and press Enter"
      onClick={() => {
        navigator.clipboard?.writeText(prompt).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      <Icon name="spark" /> Claude session
      {copied ? <span className="note">prompt copied, paste it</span> : (badge ?? <span className="note">open ›</span>)}
    </a>
  );
}
