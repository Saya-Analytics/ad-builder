import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadClientState } from '@/lib/data';
import { copyCode, driveFolderId, hookCode, pipelineSteps } from '@/lib/approvals';
import { a1, STATUS_BUILDING, TABS } from '@/lib/columns';
import { dropdownOptions, listFolder, type DriveFile } from '@/lib/google';
import { writeApprovalCell } from '@/app/actions';
import { EditableField } from '@/components/EditableField';
import { CommandButton } from '@/components/Commands';

export const dynamic = 'force-dynamic';

const DEST = [
  ['AO', '① What does Claude do?', 'action', ''],
  ['AP', '② Campaign', 'campaign', ''],
  ['AQ', '③ Ad set', 'adSet', ''],
  ['AR', '④ Copy settings from', 'copyFrom', 'The ad set whose settings Claude copies. Only when creating.'],
  ['AS', '⑤ Daily budget', 'budget', 'Only when creating. Leave blank if the campaign is CBO.'],
] as const;

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return url.toUpperCase();
  }
};

export default async function RowDetail({ params }: { params: Promise<{ clientId: string; row: string }> }) {
  const { clientId, row: rowParam } = await params;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;
  const r = s.rows.find((x) => x.row === Number(rowParam));
  if (!r) notFound();
  const st = s.status.get(r.row)!;
  const steps = pipelineSteps(r, s.copyByCode);
  const set = r.copySet ? s.copyByCode.get(copyCode(r.copySet)) : undefined;
  const sheet = s.client.sheetId;
  const cellA1 = (col: string) => a1(TABS.approvals, `${col}${r.row}`);

  const folder = driveFolderId(r.drive);
  const [files, statusOptions, ...destOptions] = await Promise.all([
    folder ? listFolder(folder).catch(() => null) : Promise.resolve(null),
    dropdownOptions(sheet, cellA1('B')).catch(() => []),
    ...DEST.map(([col]) => dropdownOptions(sheet, cellA1(col)).catch(() => [])),
  ]);
  const videos = (files ?? []).filter((f) => f.mimeType.startsWith('video/'));
  const video: DriveFile | undefined = videos.find((f) => /9x16/i.test(f.name)) ?? videos[0];
  // Several images and no video: usually a carousel (cards in name order) or one static in several sizes.
  const images = (files ?? []).filter((f) => f.mimeType.startsWith('image/')).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
  const firstImage = !video ? images[0] : undefined;

  const headline = set?.headlines[0] ?? r.headlines[0] ?? '';
  const primary = set?.primaryTexts[0] ?? r.primaryTexts[0] ?? '';
  const description = set?.descriptions[0] ?? r.descriptions[0] ?? '';
  const save = (col: string) => writeApprovalCell.bind(null, clientId, r.row, col);

  const sub =
    st.state === 'ready'
      ? 'Ready to build.'
      : st.state === 'built'
        ? `Built, paused${r.log.adId ? ` · ad ${r.log.adId}` : ''}.`
        : st.state === 'fix'
          ? st.problems[0].title + '.'
          : `Status: ${r.status}. Not in the build queue.`;

  return (
    <main className="page page-narrow">
      <div>
        <Link prefetch={false} href={`/c/${clientId}#rows`} style={{ fontSize: 17, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          ‹ All rows
        </Link>
      </div>
      <section className="section" style={{ gap: 6 }}>
        <span className="eyebrow">
          {[`Row ${r.row}`, r.brand, r.brief, r.copySet ? copyCode(r.copySet) : '', r.hook ? hookCode(r.hook) : ''].filter(Boolean).join(' · ')}
        </span>
        <h1 className="title">{headline || r.differentiation || r.adId || `Row ${r.row}`}</h1>
        <span className="sub">{sub}</span>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 1 260px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          {video ? (
            <iframe className="preview-video" src={`https://drive.google.com/file/d/${video.id}/preview`} title={`Video: ${video.name}`} allow="autoplay" />
          ) : firstImage ? (
            <iframe className="preview-video" src={`https://drive.google.com/file/d/${firstImage.id}/preview`} title={`Image: ${firstImage.name}`} />
          ) : (
            <div className="preview-video" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, color: '#cccccc', fontSize: 14, textAlign: 'center' }}>
              {folder ? (files === null ? 'Can’t open the Drive folder. Share it with the service account.' : 'No video or image in this folder.') : 'No Drive folder in Z.'}
            </div>
          )}
          {video ? <span className="xs muted">{video.name}</span> : null}
          {firstImage && images.length > 1 ? (
            <div className="stack" style={{ gap: 2 }}>
              <span className="xs strong">
                {images.length} images{r.adType.toLowerCase() === 'carousel' ? ' · carousel' : ''}. Claude views each one: a numbered sequence is one carousel (cards in this order), the same image in other sizes is dimensions.
              </span>
              <span className="xs muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {images.map((f, i) => (
                  <a key={f.id} href={`https://drive.google.com/file/d/${f.id}/view`} target="_blank" rel="noreferrer">
                    {i + 1}. {f.name}
                  </a>
                ))}
              </span>
            </div>
          ) : firstImage ? (
            <span className="xs muted">{firstImage.name}</span>
          ) : null}
          {r.drive ? (
            <a href={r.drive} target="_blank" rel="noreferrer" className="small">
              Open Drive folder ›
            </a>
          ) : null}
        </div>

        <div className="card" style={{ flex: '1 1 340px' }}>
          <span className="small muted">Ad preview</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)' }} aria-hidden="true" />
            <div>
              <div className="strong" style={{ fontSize: 15 }}>{r.brand}</div>
              <div className="xs muted">Sponsored</div>
            </div>
          </div>
          {primary ? <p style={{ whiteSpace: 'pre-line' }}>{primary}</p> : <p className="muted">No primary text yet. {r.copySet ? '' : 'Claude writes the copy on build day.'}</p>}
          <div className="adcard">
            <div style={{ minWidth: 0 }}>
              <div className="xs muted">{r.url ? domain(r.url) : 'NO URL'}</div>
              <div className="strong">{headline || '—'}</div>
              <div className="small" style={{ color: 'var(--secondary)' }}>{description}</div>
            </div>
            <span className="cta">{r.cta || 'Shop Now'}</span>
          </div>
          {set && (set.headlines.length > 1 || set.primaryTexts.length > 1) ? (
            <span className="xs muted">
              {set.code} has {set.headlines.length} headlines, {set.primaryTexts.length} primary texts, {set.descriptions.length} descriptions. Showing the first of each.
            </span>
          ) : null}
          <CommandButton clientId={clientId} command="REWRITE_COPY" args={`row ${r.row}`} label="Ask Claude to rewrite the copy" />
        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div className="card">
            <span className="small muted">Checklist</span>
            {steps.map((c) => (
              <div key={c.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className={`mark ${c.done ? 'mark-done' : 'mark-todo'}`} aria-hidden="true">
                  {c.done ? '✓' : '·'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 15 }}>
                    {c.label}
                    <span className="sr">{c.done ? ' (done)' : ' (not yet)'}</span>
                  </div>
                  <div className="small muted" style={{ overflowWrap: 'anywhere' }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="tile on-dark">
            {st.problems.length ? (
              st.problems.map((p) => (
                <div key={p.title}>
                  <div className="strong">{p.title}</div>
                  <div className="small muted">{p.fix}</div>
                </div>
              ))
            ) : (
              <span className="strong">No warnings on this row.</span>
            )}
            <EditableField dark id="Z" label="Drive folder link (column Z)" type="url" value={r.drive} save={save('Z')} />
            <EditableField dark id="Y" label="Final URL (column Y)" type="url" value={r.url} save={save("Y")} hint="Blank: Claude picks the page from the creative, or the homepage if unsure." />
            <EditableField
              dark
              id="B"
              label="Status (column B)"
              value={r.status}
              options={statusOptions.length ? statusOptions : [STATUS_BUILDING]}
              save={save('B')}
              hint={`“${STATUS_BUILDING}” puts the row in Claude’s build queue.`}
            />
          </div>
        </div>
      </div>

      <section className="card" aria-label="Destination">
        <div className="row-between">
          <h2 className="h2">Destination · where Claude builds it</h2>
          <span className="small muted">AO–AS</span>
        </div>
        <div className="grid-cards" style={{ gap: 16 }}>
          {DEST.map(([col, label, key, hint], i) => (
            <EditableField key={col} id={col} label={`${label} (${col})`} value={r[key]} options={destOptions[i]} save={save(col)} hint={hint || undefined} allowOther={col !== 'AO'} />
          ))}
        </div>
        <EditableField
          id="AV"
          label="📝 Copy notes for Claude (AV)"
          value={r.copyNotes}
          save={save('AV')}
          hint="Leave blank and Claude writes the copy from the creative alone. Either way it reads the creative, the landing page and these notes."
        />
        {r.check ? <span className="small muted">Sheet check (AT): {r.check}</span> : null}
      </section>

      {r.log.raw ? (
        <section className="notice small" aria-label="Build log">
          <strong>Build log (AU, written by Claude)</strong>
          <span style={{ overflowWrap: 'anywhere' }}>{r.log.raw}</span>
        </section>
      ) : null}
    </main>
  );
}
