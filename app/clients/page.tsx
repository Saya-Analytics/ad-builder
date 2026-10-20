import Link from 'next/link';
import { loadClients, loadClientState, sheetUrl, driveFolderUrl } from '@/lib/data';
import { builds, longDate } from '@/lib/summary';
import { serviceAccountEmail } from '@/lib/google';
import { ADDABLE_TABS } from '@/lib/columns';
import { AddClientForm, OffboardButton, RepairTabsButton, SetupChecklist } from '@/components/ClientForms';
import { ConfigError } from '@/components/ConfigError';
import { onboardingDefaults } from '@/lib/setup';

export const dynamic = 'force-dynamic';

export default async function Clients({ searchParams }: { searchParams: Promise<{ offboarded?: string }> }) {
  const { offboarded } = await searchParams;
  let clients;
  try {
    clients = await loadClients();
  } catch (e) {
    return <ConfigError error={e} />;
  }
  const active = clients.filter((c) => c.status !== 'Offboarded');
  const off = clients.filter((c) => c.status === 'Offboarded');
  const defaults = onboardingDefaults();
  const justOff = off.find((c) => c.id === offboarded);
  const states = await Promise.all(active.map((c) => loadClientState(c.id)));

  return (
    <main className="page page-narrow">
      <div>
        {active[0] ? (
          <Link prefetch={false} href={`/c/${active[0].id}`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            ‹ Home
          </Link>
        ) : null}
      </div>
      {offboarded && justOff ? (
        <div className="banner" role="status">
          {justOff.name} is offboarded. Now pause {justOff.name}’s scheduled task in Claude. The sheet, Drive and ads were not touched.
        </div>
      ) : null}
      <section className="section" style={{ gap: 6 }}>
        <span className="eyebrow">AD BUILDER CLIENTS · master sheet</span>
        <h1 className="title">Clients</h1>
      </section>

      <div className="grid-cards">
        {active.map((c, i) => {
          const l = states[i];
          const last = l.ok ? builds(l.state)[0] : undefined;
          const missing = l.ok ? l.state.missingTabs : [];
          const addable = missing.filter((t) => (ADDABLE_TABS as readonly string[]).includes(t));
          return (
            <div key={c.id} id={c.id} className="card" style={{ gap: 8 }}>
              <div className="row-between">
                <Link prefetch={false} href={`/c/${c.id}`} className="strong" style={{ fontSize: 21, color: 'var(--ink)' }}>
                  {c.name}
                </Link>
                <span className={`status ${!l.ok || missing.length || l.state.layoutIssue ? 'status-fix' : 'status-ready'}`}>{!l.ok ? 'Can’t read' : missing.length || l.state.layoutIssue ? 'Setup incomplete' : 'Active'}</span>
              </div>
              {!l.ok ? (
                <span className="small">
                  {l.kind === 'access' ? `Can’t read ${c.name}’s sheet. Share it with ${serviceAccountEmail()}.` : l.error}
                </span>
              ) : null}
              {missing.length ? <span className="small">Missing tabs: {missing.join(', ')}</span> : null}
              {l.ok && l.state.layoutIssue ? <span className="small">{l.state.layoutIssue}</span> : null}
              {addable.length ? <RepairTabsButton clientId={c.id} tabs={addable} /> : null}
              <span className="small muted">
                {last ? `Last build ${longDate(last.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${last.total} ads` : 'No build logged yet'}
                {c.addedOn ? ` · added ${c.addedOn}` : ''}
              </span>
              <div className="wrap" style={{ gap: 16, alignItems: 'center' }}>
                <a href={sheetUrl(c.sheetId)} target="_blank" rel="noreferrer" className="small">
                  Control sheet ›
                </a>
                {c.driveRootId ? (
                  <a href={driveFolderUrl(c.driveRootId)} target="_blank" rel="noreferrer" className="small">
                    Drive ›
                  </a>
                ) : null}
                <details className="small">
                  <summary style={{ color: 'var(--accent)', cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Setup checklist</summary>
                  <SetupChecklist clientId={c.id} />
                </details>
                <OffboardButton clientId={c.id} name={c.name} />
              </div>
            </div>
          );
        })}
      </div>

      <section id="add" className="section">
        <AddClientForm
          serviceAccount={serviceAccountEmail()}
          defaults={{
            buildDay: defaults.buildDay ?? 'Thursday',
            timezone: defaults.timezone ?? '',
            afterBuildStatus: defaults.afterBuildStatus ?? '',
            slackChannelId: defaults.slackChannelId ?? '',
            slackTags: defaults.slackTags ?? '',
          }}
        />
      </section>

      {off.length ? (
        <section className="section">
          <h2 className="h2">Offboarded</h2>
          <div className="card" style={{ padding: '8px 24px', gap: 0 }}>
            {off.map((c) => (
              <div key={c.id} className="line">
                <div style={{ flex: 1 }} className="row-between">
                  <span>{c.name}</span>
                  <span className="small muted">
                    since {c.offboardedOn || '—'} ·{' '}
                    <a href={sheetUrl(c.sheetId)} target="_blank" rel="noreferrer">
                      sheet ›
                    </a>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">Offboarding only hides a client here. To bring one back, set its status to Active in the master sheet.</p>
        </section>
      ) : null}
    </main>
  );
}
