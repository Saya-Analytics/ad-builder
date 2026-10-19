'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addBrand, addClient, offboardClient, repairTabs, type ClientFormState } from '@/app/actions';

export function AddClientForm({ serviceAccount }: { serviceAccount: string }) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(addClient, {});
  if (state.ok && state.clientId) {
    return (
      <div className="card">
        <h2 className="h2">Client added</h2>
        {state.added?.length ? <p className="small">Added tabs: {state.added.join(', ')}.</p> : null}
        {state.missingRequired?.length ? (
          <p className="small">
            <strong>Setup incomplete:</strong> the sheet has no {state.missingRequired.join(', ')} tab. The app can’t create these; copy them from another control sheet.
          </p>
        ) : null}
        <SetupChecklist clientId={state.clientId} />
      </div>
    );
  }
  return (
    <form action={action} className="card" style={{ maxWidth: 640 }}>
      <h2 className="h2">Add a client</h2>
      <p className="small muted">Share the control sheet with {serviceAccount} (Editor) first. The app checks its tabs and adds CLAUDE SETUP and COMMANDS if they’re missing.</p>
      <label className="field">
        Client name
        <input className="input" name="name" required placeholder="Ashtel Studios" />
      </label>
      <label className="field">
        Control sheet link
        <input className="input" name="sheet" required placeholder="https://docs.google.com/spreadsheets/d/…" />
      </label>
      <label className="field">
        Drive root folder link
        <input className="input" name="drive" required placeholder="https://drive.google.com/drive/folders/…" />
      </label>
      {state.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn" disabled={pending}>
          {pending ? 'Checking the sheet…' : 'Add client'}
        </button>
      </div>
    </form>
  );
}

export function SetupChecklist({ clientId }: { clientId: string }) {
  const steps = [
    ['Fill CLAUDE SETUP', <Link key="s" href={`/c/${clientId}/settings`}>Settings ›</Link>, 'Build day, timezone, Slack channel, tags, status after build, Claude chat link'],
    ['Add the brands', <Link key="b" href={`/c/${clientId}/settings#brands`}>Settings ›</Link>, 'One row per brand (as in column AF) → act_… ad account'],
    ['Invite Claude to the Slack channel', null, 'So the @Claude tag reaches it'],
    ['Create the scheduled task in Claude', null, 'Daily, running the client’s skill; it reads COMMANDS on every run'],
    ['Share the Drive root with the service account', null, 'Viewer is enough, for video previews'],
  ] as const;
  return (
    <div>
      {steps.map(([title, link, detail]) => (
        <div className="line" key={title}>
          <span className="mark mark-todo" aria-hidden="true">
            ○
          </span>
          <div style={{ flex: 1 }}>
            <div className="row-between">
              <span className="strong">{title}</span>
              {link}
            </div>
            <div className="small muted">{detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OffboardButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className="linkbtn small"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Offboard ${name}? It disappears from the switcher. The sheet, Drive folders and ads stay as they are.`)) return;
          start(async () => {
            const r = await offboardClient(clientId);
            // The card disappears once the list refreshes, so the reminder lives on the page.
            if (r.ok) router.push(`/clients?offboarded=${encodeURIComponent(clientId)}`);
            else setMsg('conflict' in r ? `Changed in the master sheet: “${r.conflict.current}”. Reload.` : r.error);
          });
        }}
      >
        {pending ? 'Offboarding…' : 'Offboard ›'}
      </button>
      {msg ? (
        <span className="small" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  );
}

export function RepairTabsButton({ clientId, tabs }: { clientId: string; tabs: string[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" className="linkbtn small" disabled={pending} onClick={() => start(async () => {
        const r = await repairTabs(clientId);
        setMsg(r.ok ? `Added ${r.added?.join(', ') || 'nothing'}.` : r.error ?? 'Failed');
      })}>
        {pending ? 'Adding…' : `Add ${tabs.join(' and ')} ›`}
      </button>
      {msg ? <span className="small" role="status">{msg}</span> : null}
    </span>
  );
}

export function AddBrandForm({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="wrap"
      style={{ alignItems: 'flex-end' }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const r = await addBrand(clientId, String(f.get('brand') ?? ''), String(f.get('account') ?? ''));
          setMsg(r.ok ? 'Brand added ✓' : 'error' in r ? r.error : 'Failed');
          if (r.ok) form.reset();
        });
      }}
    >
      <label className="field" style={{ flex: '1 1 180px' }}>
        Brand (as in AF)
        <input className="input" name="brand" required />
      </label>
      <label className="field" style={{ flex: '1 1 220px' }}>
        Ad account
        <input className="input" name="account" placeholder="act_…" />
      </label>
      <button className="btn btn-sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add brand'}
      </button>
      {msg ? <span className="small" role="status">{msg}</span> : null}
    </form>
  );
}
