import Link from 'next/link';
import { loadClientState } from '@/lib/data';
import { activeRows, blockers, brandCounts, builds, counts, daysToBuild, greeting, longDate, organizedCount } from '@/lib/summary';
import { copyCode, rowRanges } from '@/lib/approvals';
import { setupValue, slackChannel } from '@/lib/setup';
import { commandInterval, trackedCommands } from '@/lib/tracked';
import { AskClaude, CommandButton, type Suggestion } from '@/components/Commands';
import { CommandTracker } from '@/components/CommandTracker';
import { AskFixButton, BuildButton } from '@/components/BuildPanel';
import { BrandFilter, RowsTable } from '@/components/RowsTable';
import { permalink } from '@/lib/slack';

export const dynamic = 'force-dynamic';

const MAX_BARS = 30;

function Bars({ parts, total }: { parts: { n: number; cls: string }[]; total: number }) {
  // One bar per item, scaled down when there are more than MAX_BARS.
  const scale = total > MAX_BARS ? MAX_BARS / total : 1;
  const cells: string[] = [];
  for (const p of parts) for (let i = 0; i < Math.round(p.n * scale); i++) cells.push(p.cls);
  while (cells.length < Math.round(total * scale)) cells.push('');
  return (
    <div className="bars" aria-hidden="true">
      {cells.map((c, i) => (
        <span key={i} className={c} />
      ))}
    </div>
  );
}

export default async function Home({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ brand?: string }> }) {
  const { clientId } = await params;
  const { brand = '' } = await searchParams;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;
  const base = `/c/${clientId}`;

  const rows = activeRows(s);
  const { ready, fix, total } = counts(s, rows);
  const queue = rows.filter((r) => !r.log.built);
  const organized = organizedCount(rows);
  const usedCodes = new Set(rows.map((r) => copyCode(r.copySet)).filter(Boolean));
  const activeCopy = s.copy.filter((c) => !c.status || c.status.toLowerCase() === 'active');
  const build = daysToBuild(s);
  const needs = blockers(s, commandInterval(s), base);
  const last = builds(s)[0];
  const channel = slackChannel(s.setup);
  const commands = await trackedCommands(s, 5);
  const brands = brandCounts(s, rows);
  const firstBrand = brands.find((b) => b.n)?.brand;
  const brandRows = firstBrand ? rows.filter((r) => r.brand === firstBrand).map((r) => r.row) : [];

  const suggestions: Suggestion[] = [];
  suggestions.push({ label: 'Check new creative drops', command: 'CHECK' });
  if (fix.length) {
    const r = rowRanges(fix.map((x) => x.row));
    suggestions.push({ label: `Re-check rows ${r}`, command: 'ASK', args: `Re-check rows ${r} after our fixes and update AU` });
  }
  suggestions.push({ label: 'Post today’s status to Slack', command: 'STATUS' });

  const shown = brand ? rows.filter((r) => r.brand === brand) : rows;

  return (
    <main className="page">
      <section aria-label="Ask Claude" className="ask">
        <p className="eyebrow">
          {longDate(s.today)}
          {build ? ` · ${build.days === 0 ? `${build.day} build is today` : `${build.days} day${build.days === 1 ? '' : 's'} to the ${build.day} build`}` : ''}
        </p>
        <h1 className="hero">{greeting(s.timezone)}</h1>
        <p className="lede">What should we build this week?</p>
        <AskClaude
          clientId={clientId}
          suggestions={suggestions}
          example={firstBrand && brandRows.length ? `Write new copy for ${firstBrand} rows ${rowRanges(brandRows)}` : 'Check new creative drops'}
        >
          {queue.length ? (
            <BuildButton clientId={clientId} variant="pill" label={`Build ${queue.length} ad${queue.length === 1 ? '' : 's'} (${ready.length} ready)`} />
          ) : null}
        </AskClaude>
      </section>

      <section aria-label="This week" className="section">
        <h2 className="h2">This week</h2>
        <div className="kpis">
          <div className="kpi">
            <span className="num">{ready.length}</span>
            <span className="strong" style={{ fontSize: 15 }}>Ready to build</span>
            <Bars total={queue.length} parts={[{ n: ready.length, cls: 'b-on' }, { n: fix.filter((r) => !r.log.built).length, cls: 'b-fix' }]} />
            <span className="small muted">
              {ready.length} of {queue.length} row{queue.length === 1 ? '' : 's'} waiting to build
            </span>
          </div>
          <div className="kpi">
            <span className="num">{fix.length}</span>
            <span className="strong" style={{ fontSize: 15 }}>Need a fix</span>
            <Bars total={total} parts={[{ n: total - fix.length, cls: '' }, { n: fix.length, cls: 'b-fix' }]} />
            <span className="small muted">{fix.length ? `Row${fix.length === 1 ? '' : 's'} ${rowRanges(fix.map((r) => r.row))}` : 'Nothing to fix'}</span>
          </div>
          <div className="kpi">
            <span className="num">{organized}</span>
            <span className="strong" style={{ fontSize: 15 }}>Creatives organized</span>
            <Bars total={total} parts={[{ n: organized, cls: 'b-on' }]} />
            <span className="small muted">
              {organized} of {total} rows have their own Drive folder
            </span>
          </div>
          <div className="kpi">
            <span className="num">{activeCopy.length}</span>
            <span className="strong" style={{ fontSize: 15 }}>Copy sets in library</span>
            <Bars total={activeCopy.length} parts={[{ n: activeCopy.filter((c) => usedCodes.has(c.code)).length, cls: 'b-on' }]} />
            <span className="small muted">
              {s.copy.length ? `${s.copy[0].code}–${s.copy[s.copy.length - 1].code}` : 'Empty'} · {s.hooks.length} hooks
            </span>
          </div>
        </div>
      </section>

      <section className="split">
        <div className="section">
          <h2 className="h2">Needs you</h2>
          <div className="tile on-dark" style={{ flex: 1, padding: '8px 24px' }}>
            {needs.length ? (
              needs.map((b, i) => (
                <div className="blocker" key={i}>
                  <span className="bang" aria-hidden="true">!</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong" style={{ fontSize: 15 }}>{b.title}</div>
                    <div className="small muted">{b.fix}</div>
                  </div>
                  {b.rows ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
                      <BuildButton clientId={clientId} mode="fix" rows={b.rows} problem={b.problem} label="Fix here" variant="link" />
                      <AskFixButton clientId={clientId} rows={b.rows} problem={b.problem ?? b.title} />
                    </div>
                  ) : (
                    <Link prefetch={false} href={b.href} style={{ fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      {b.action} ›
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <p style={{ padding: '16px 0' }}>Nothing is blocked.</p>
            )}
            {needs.length && channel ? (
              <div style={{ padding: '14px 0' }}>
                <CommandButton clientId={clientId} command="STATUS" label="Ping the team in Slack" dark />
              </div>
            ) : null}
          </div>
        </div>

        <div className="section">
          <h2 className="h2">Last build</h2>
          <div className="card" style={{ flex: 1, gap: 18 }}>
            {last ? (
              <>
                <div className="row-between" style={{ alignItems: 'baseline' }}>
                  <span className="num">
                    {last.rows.filter((r) => r.log.adId).length} of {last.total}
                  </span>
                  <span className="small muted">
                    {longDate(last.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {last.rows.every((r) => /PAUSED/i.test(r.log.raw)) ? ' · all paused' : ''}
                  </span>
                </div>
                {last.brands.map((b, i) => (
                  <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="initials" style={{ background: i === 0 ? 'var(--accent)' : 'var(--ink)' }}>
                      {b.brand.replace(/^Get\s+/i, '').slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong" style={{ fontSize: 15 }}>{b.brand}</div>
                      <div className="small muted">{[b.campaign, b.adSet].filter(Boolean).join(' › ')}</div>
                    </div>
                    <span className="strong" style={{ fontSize: 15 }}>
                      {b.adIds.length} ad{b.adIds.length === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
                <div className="wrap" style={{ marginTop: 'auto', gap: 10 }}>
                  <Link prefetch={false} href={`${base}/builds#${last.date}`} className="btn btn-outline btn-sm">
                    See build log
                  </Link>
                  {last.command && channel ? (
                    <a href={permalink(channel, last.command.slackTs, last.command.slackThread)} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 15 }}>
                      Slack thread ›
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="muted">No build logged in AU yet.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Claude requests" className="section">
        <div className="row-between">
          <h2 className="h2">Asked of Claude</h2>
          <Link prefetch={false} href={`${base}/commands`} className="small">All requests ›</Link>
        </div>
        <div className="card" style={{ padding: '8px 24px', gap: 0 }}>
          <CommandTracker clientId={clientId} initial={commands} chatLink={setupValue(s.setup, 'claudeChat') || undefined} />
        </div>
      </section>

      <section aria-label="Rows" className="section" id="rows">
        <div className="row-between">
          <h2 className="h2">Rows in the sheet</h2>
          <BrandFilter base={base} brands={brands} current={brand} />
        </div>
        <RowsTable state={s} rows={shown} />
      </section>
    </main>
  );
}
