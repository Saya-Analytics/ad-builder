import Link from 'next/link';
import { loadClientState } from '@/lib/data';
import { adsManagerUrl, builds, longDate, type Build } from '@/lib/summary';
import { copyCode, driveFolderId, hookCode, rowRanges } from '@/lib/approvals';
import { setupValue, slackChannel } from '@/lib/setup';
import { permalink } from '@/lib/slack';
import { CommandButton } from '@/components/Commands';

export const dynamic = 'force-dynamic';

const codeRange = (codes: string[]) => {
  const u = [...new Set(codes.filter(Boolean))].sort();
  return u.length > 1 ? `${u[0]}–${u[u.length - 1]}` : u[0] ?? '';
};

/** Steps of the build as far as the sheet shows them. No times: AU doesn't log them. */
function steps(b: Build) {
  const byBrand = b.brands.map((x) => `${x.rows.length} ${x.brand}`).join(', ');
  const folders = b.rows.filter((r) => driveFolderId(r.drive)).length;
  const copies = codeRange(b.rows.map((r) => (r.copySet ? copyCode(r.copySet) : '')));
  const hooks = codeRange(b.rows.map((r) => (r.hook ? hookCode(r.hook) : '')));
  const adSets = b.brands.flatMap((x) => x.adSetIds.map((id) => `${x.brand} ${id}`));
  const ads = b.rows.filter((r) => r.log.adId).length;
  return [
    { title: 'Started', detail: `${b.total} rows · ${byBrand}`, done: true },
    { title: 'Drive organized', detail: `${folders} of ${b.total} rows point to their own folder (Z)`, done: folders === b.total },
    { title: 'Copy written', detail: copies ? `${copies} in COPY${hooks ? ` · hooks ${hooks}` : ''}` : 'No copy sets in F', done: !!copies },
    { title: 'Ad sets created, paused', detail: adSets.length ? adSets.join(' · ') : 'Built into existing ad sets', done: true },
    { title: 'Ads launched, paused', detail: `${ads} of ${b.total}`, done: ads === b.total },
    { title: 'Logged', detail: `AU filled on rows ${rowRanges(b.rows.map((r) => r.row))}`, done: true },
  ];
}

export default async function Builds({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;
  const list = builds(s);
  const channel = slackChannel(s.setup);

  if (!list.length) {
    return (
      <main className="page page-narrow">
        <h1 className="title">Builds</h1>
        <p className="muted">No build logged in AU yet.</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow" style={{ gap: 64 }}>
      {list.map((b) => {
        const ads = b.rows.filter((r) => r.log.adId).length;
        const paused = b.rows.every((r) => /PAUSED/i.test(r.log.raw));
        const warnings = b.brands.flatMap((x) => x.warnings);
        return (
          <article key={b.date} id={b.date} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section className="section" style={{ gap: 6 }}>
              <span className="eyebrow">Build · {longDate(b.date)}</span>
              <h1 className="title">
                {ads} ad{ads === 1 ? '' : 's'} built.{paused ? ' All paused.' : ''}
              </h1>
              <span className="sub">
                Logged in the sheet{b.command ? '. Posted in Slack.' : '.'}
              </span>
            </section>

            <div className="grid-cards">
              {b.brands.map((x) => {
                const url = adsManagerUrl(x.account, x.adIds);
                return (
                  <div key={x.brand} className="card" style={{ gap: 6 }}>
                    <span className="small muted">
                      {x.brand} · {[x.campaign, x.adSet].filter(Boolean).join(' › ')}
                    </span>
                    <span className="num">
                      {x.adIds.length} of {x.rows.length}
                    </span>
                    {x.adSetIds.length ? <span className="xs muted">Ad set {x.adSetIds.join(', ')}</span> : null}
                    <span className="xs muted" style={{ overflowWrap: 'anywhere' }}>
                      Ads {x.adIds.join(', ')}
                    </span>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        Open in Ads Manager ›
                      </a>
                    ) : (
                      <Link prefetch={false} href={`/c/${clientId}/settings#brands`} className="small">
                        No confirmed ad account for {x.brand} ›
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {warnings.length ? (
              <div className="tile on-dark">
                <span className="strong">Check before turning on</span>
                {warnings.map((w) => (
                  <Link prefetch={false} key={w.row} href={`/c/${clientId}/rows/${w.row}`} className="small">
                    Row {w.row}: {w.text} ›
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="card" style={{ padding: '8px 24px', gap: 0 }}>
              {steps(b).map((t) => (
                <div className="line" key={t.title}>
                  <span className={`mark ${t.done ? 'mark-done' : 'mark-att'}`} aria-hidden="true">
                    {t.done ? '✓' : '!'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="strong">{t.title}</span>
                    <div className="small" style={{ color: 'var(--secondary)', overflowWrap: 'anywhere' }}>
                      {t.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
              <CommandButton clientId={clientId} command="RECHECK_BUILD" args={b.date} label="Ask Claude to re-check this build" variant="outline" />
              {b.command && channel ? (
                <a href={permalink(channel, b.command.slackTs, b.command.slackThread)} target="_blank" rel="noreferrer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                  Slack thread ›
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </main>
  );
}
