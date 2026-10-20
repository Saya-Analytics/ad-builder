import Link from 'next/link';
import type { Client, ClientState } from '@/lib/data';
import { activeRows, brandCounts, counts } from '@/lib/summary';
import { setupValue } from '@/lib/setup';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { Search, type SearchItem } from './Search';
import { BuildButton } from './BuildPanel';
import { RefreshButton } from './RefreshButton';
import { isOpen } from '@/lib/commands';
import { queuePrompt } from '@/lib/reminders';
import { ClaudeSessionLink } from './ClaudeSessionLink';

export interface Connection {
  name: string;
  ok: boolean;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function Sidebar({
  client,
  clients,
  state,
  brand,
  connections,
}: {
  client: Client;
  clients: Client[];
  state: ClientState | null;
  brand?: string;
  connections: Connection[];
}) {
  const base = `/c/${client.id}`;
  const rows = state ? activeRows(state) : [];
  const c = state ? counts(state, rows) : null;
  const brands = state ? brandCounts(state, rows) : [];
  const buildDay = setupValue(state?.setup ?? null, 'buildDay');
  const search: SearchItem[] = rows.map((r) => ({
    href: `${base}/rows/${r.row}`,
    title: `Row ${r.row}`,
    detail: [r.brand, r.differentiation || r.adId, r.product, r.hook].filter(Boolean).join(' · '),
  }));

  return (
    <aside className="sidebar" aria-label="Main menu">
      <details className="switcher">
        <summary className="client-btn">
          <span className="avatar">{initials(client.name)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <span className="strong" style={{ fontSize: 15 }}>
              {client.name}
            </span>
            <span className="xs muted">
              {brands.length} brand{brands.length === 1 ? '' : 's'}
              {buildDay ? ` · ${buildDay} builds` : ''}
            </span>
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <Icon name="chevron" size={14} stroke="#7a7a7a" width={2} />
          </span>
        </summary>
        <div className="menu" role="menu">
          {clients.map((x) => (
            <Link prefetch={false} key={x.id} href={`/c/${x.id}`} className="navbtn" role="menuitem" aria-current={x.id === client.id ? 'page' : undefined}>
              <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                {initials(x.name)}
              </span>
              {x.name}
            </Link>
          ))}
          <div className="side-rule" style={{ margin: '6px 4px' }} />
          <Link prefetch={false} href="/clients#add" className="navbtn" role="menuitem">
            <Icon name="plus" /> Add client
          </Link>
          <Link prefetch={false} href="/clients" className="navbtn" role="menuitem">
            <Icon name="clients" /> All clients · offboard
          </Link>
        </div>
      </details>

      {state ? <BuildButton clientId={client.id} /> : null}
      <ClaudeSessionLink
        href={setupValue(state?.setup ?? null, 'claudeChat') || null}
        open={state ? state.commands.filter(isOpen).length : 0}
        settings={`${base}/settings`}
        prompt={queuePrompt(setupValue(state?.setup ?? null, 'clientName') || client.name, client.sheetId)}
      />
      <RefreshButton />
      <Search items={search} />

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink href={base} icon="home" label="Home" exact />
        <NavLink href={`${base}/rows`} icon="rows" label="Rows" note={c ? String(c.total) : undefined} />
        <NavLink href={`${base}/builds`} icon="builds" label="Builds" />
        <NavLink href={`${base}/commands`} icon="commands" label="Claude requests" />
        <NavLink href={`${base}/settings`} icon="settings" label="Settings" />
        <NavLink href="/clients" icon="clients" label="Clients" />
      </nav>

      {brands.length ? (
        <>
          <div className="side-rule" />
          <span className="side-label">Brands</span>
          {brands.map((b, i) => (
            <Link prefetch={false}
              key={b.brand}
              href={`${base}/rows?brand=${encodeURIComponent(b.brand)}`}
              className="navbtn"
              aria-current={brand === b.brand ? 'page' : undefined}
              style={{ minHeight: 40 }}
            >
              <span className="dot" style={{ background: b.n === 0 ? '#c7c7cc' : i === 0 ? 'var(--accent)' : 'var(--ink)' }} aria-hidden="true" />
              {b.brand}
              <span className="note">{b.n ? `${b.n} row${b.n === 1 ? '' : 's'}` : 'no rows'}</span>
            </Link>
          ))}
        </>
      ) : null}

      <div className="side-rule" />
      <span className="side-label">Connections</span>
      <div className="wrap" style={{ gap: 6, padding: '0 10px' }}>
        {connections.map((x) => (
          <span key={x.name} className="chip-conn" title={x.ok ? `${x.name} connected` : `${x.name} not connected`}>
            <span className={x.ok ? 'on' : 'off'} aria-hidden="true" />
            {x.name}
            {x.ok ? '' : ' · off'}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 4 }}>
        <a className="ghosticon" href={`https://docs.google.com/spreadsheets/d/${client.sheetId}`} target="_blank" rel="noreferrer" aria-label="Open the control sheet">
          <Icon name="sheet" />
        </a>
        <Link prefetch={false} className="ghosticon" href={`${base}/settings`} aria-label="Settings">
          <Icon name="settings" />
        </Link>
      </div>
    </aside>
  );
}
