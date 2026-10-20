'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addBrand, addClient, offboardClient, repairTabs, type ClientFormState } from '@/app/actions';

export interface OnboardingDefaults {
  buildDay: string;
  timezone: string;
  afterBuildStatus: string;
  slackChannelId: string;
  slackTags: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

export function AddClientForm({ serviceAccount, defaults }: { serviceAccount: string; defaults: OnboardingDefaults }) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(addClient, {});
  const f = state.fields ?? {};
  const [name, setName] = useState(f.name ?? '');
  const [skillTouched, setSkillTouched] = useState(!!f.skill);
  const [skill, setSkill] = useState(f.skill ?? '');
  const [portfolio, setPortfolio] = useState(!!f.brands);
  const shownSkill = skillTouched ? skill : 'ad-builder';

  if (state.ok && state.clientId) {
    return (
      <div className="card">
        <h2 className="h2">Client added</h2>
        {state.added?.length ? <p className="small">Added tabs: {state.added.join(', ')}.</p> : null}
        {state.brands?.length ? (
          <p className="small">
            Brands in CLAUDE SETUP: {state.brands.map((b) => `${b.brand} → ${b.account || 'no ad account yet'}`).join(' · ')}
          </p>
        ) : null}
        {state.layoutIssue ? (
          <p className="banner small" role="alert">
            {state.layoutIssue}
          </p>
        ) : null}
        {state.missingRequired?.length ? (
          <p className="banner small" role="alert">
            Setup incomplete: the sheet has no {state.missingRequired.join(', ')} tab. Claude needs them to write copy and hooks. Copy them from
            another control sheet (right-click the tab → Copy to → this sheet, then rename it).
          </p>
        ) : null}
        <SetupChecklist clientId={state.clientId} skill={state.skill} />
      </div>
    );
  }
  return (
    <form action={action} className="card" style={{ maxWidth: 760 }} autoComplete="off">
      <h2 className="h2">Add a client</h2>
      <p className="small muted">
        First share the control sheet with {serviceAccount} as Editor, and the creatives folder as Viewer. The app checks the sheet, adds the CLAUDE SETUP
        and COMMANDS tabs and fills them in.
      </p>
      <div className="grid-cards" style={{ gap: 16 }}>
        <label className="field">
          Client name
          <input className="input" name="name" required placeholder="MissA" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Meta ad account
          <input className="input" name="account" placeholder="act_…" defaultValue={f.account} />
          <span className="xs muted">The client’s ad account. Can be added later in Settings.</span>
        </label>
        <label className="field">
          Control sheet link
          <input className="input" name="sheet" required placeholder="https://docs.google.com/spreadsheets/d/…" defaultValue={f.sheet} />
        </label>
        <label className="field">
          Creatives folder in Drive
          <input className="input" name="drive" required placeholder="https://drive.google.com/drive/folders/…" defaultValue={f.drive} />
        </label>
        <label className="field">
          Claude chat for this client
          <input className="input" name="chat" type="url" placeholder="https://claude.ai/…" defaultValue={f.chat} />
          <span className="xs muted">Create a new chat or project in Claude for the client and paste its link.</span>
        </label>
        <label className="field">
          Skill
          <input
            className="input"
            name="skill"
            placeholder="ad-builder"
            value={shownSkill}
            onChange={(e) => {
              setSkillTouched(true);
              setSkill(e.target.value);
            }}
          />
          <span className="xs muted">The skill Claude runs for this client.</span>
        </label>
        <label className="field">
          Build day
          <select className="select" name="buildDay" defaultValue={f.buildDay ?? defaults.buildDay}>
            {DAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
        <input type="checkbox" checked={portfolio} onChange={(e) => setPortfolio(e.target.checked)} />
        This client has several brands (a portfolio, like Ashtel Studios)
      </label>
      {portfolio ? (
        <label className="field">
          Brands, one per line: brand exactly as in column AF | ad account
          <textarea className="input" name="brands" rows={4} style={{ borderRadius: 18, padding: 14 }} placeholder={'EVO | act_970523986836813\nGet ARU | act_1494497458618520'} defaultValue={f.brands} />
        </label>
      ) : (
        <p className="xs muted">Single brand: the app uses the brand name the sheet already has in column AF, or the client name.</p>
      )}

      <details className="small">
        <summary style={{ cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}>
          Defaults: {defaults.timezone} · after build “{defaults.afterBuildStatus}” · Slack {defaults.slackChannelId || 'not set'}
        </summary>
        <div className="grid-cards" style={{ gap: 16, marginTop: 8 }}>
          <label className="field">
            Timezone
            <input className="input" name="timezone" defaultValue={f.timezone ?? defaults.timezone} />
          </label>
          <label className="field">
            Status after Claude builds
            <input className="input" name="afterBuildStatus" defaultValue={f.afterBuildStatus ?? defaults.afterBuildStatus} />
          </label>
          <label className="field">
            Slack channel ID
            <input className="input" name="slackChannelId" defaultValue={f.slackChannelId ?? defaults.slackChannelId} />
          </label>
          <label className="field">
            Tag on roadblocks
            <input className="input" name="slackTags" defaultValue={f.slackTags ?? defaults.slackTags} />
          </label>
        </div>
      </details>

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

export function SetupChecklist({ clientId, skill }: { clientId: string; skill?: string }) {
  const steps = [
    ['Check the settings', <Link prefetch={false} key="s" href={`/c/${clientId}/settings`}>Settings ›</Link>, 'Filled from the form and the defaults. Add the ad account here if you skipped it.'],
    ['Create the skill in Claude', null, `${skill ? `“${skill}”: ` : ''}copy an existing ad-builder skill and change its client config`],
    ['Create the scheduled task in Claude', null, 'In the client’s Claude chat, running the skill daily. It reads COMMANDS on every run.'],
    ['Make sure Claude is in the Slack channel', null, 'So the @Claude tag reaches it'],
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
