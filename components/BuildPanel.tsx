'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { askClaudeToFix, getBuildPlan, saveRowEdits, submitBuild, type BuildPlan, type PlanRow, type RowEdit, type SaveResult } from '@/app/build-actions';
import type { SendResult } from '@/app/actions';
import { CommandOutcome } from './Commands';
import { Icon } from './Icon';

type Col = keyof PlanRow['cells'];
const COL_NAME: Record<Col, string> = {
  Y: 'URL',
  Z: 'Drive link',
  AO: 'What to do',
  AP: 'Campaign',
  AQ: 'Ad set',
  AR: 'Copy settings from',
  AS: 'Daily budget',
  AV: 'Copy notes',
};

const OTHER = '__other__';

/**
 * A real dropdown of what exists in Ads Manager (from META_LIST), with "Type a different name…"
 * for names that aren't listed yet. Datalists were unreliable (filtered, invisible in Safari/dialogs).
 */
function Pick({ value, options, onChange, label, placeholder, disabled, free }: { value: string; options: string[]; onChange: (v: string) => void; label: string; placeholder: string; disabled?: boolean; free?: boolean }) {
  const [typing, setTyping] = useState(false);
  if (free || typing || !options.length)
    return (
      <span className="stack" style={{ gap: 2 }}>
        <input className="input" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        {!free && options.length && !disabled ? (
          <button type="button" className="linkbtn xs" style={{ minHeight: 28 }} onClick={() => setTyping(false)}>
            Pick from the list ›
          </button>
        ) : null}
      </span>
    );
  const listed = !value || options.includes(value);
  return (
    <select
      className="select"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => (e.target.value === OTHER ? setTyping(true) : onChange(e.target.value))}
    >
      <option value="">{placeholder}</option>
      {!listed ? <option value={value}>{value} (not in the list)</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OTHER}>✎ Type a different name…</option>
    </select>
  );
}

/** What would still stop Claude, judged from the panel's values (same rules as the AT check). */
function missing(v: PlanRow['cells']): string[] {
  const out: string[] = [];
  // Only digits = a creator's post ID for a partnership ad.
  if (!/drive\.google\.com\//.test(v.Z) && !/^\d{8,}(_\d{8,})?$/.test(v.Z.trim())) out.push('Drive folder link or creator post ID');
  if (!v.AO) out.push('what to do');
  else if (v.AO !== 'SAME AS ROW ABOVE') {
    if (!v.AP) out.push('campaign');
    if (!v.AQ) out.push('ad set');
    if (v.AO.startsWith('CREATE') && !v.AR) out.push('ad set to copy settings from');
  }
  return out;
}

const rangeText = (rows: number[]) => {
  const s = [...rows].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`);
    i = j;
  }
  return out.join(', ');
};

/**
 * Opens the Build panel. mode "build": pick rows and destinations, then ask Claude to build.
 * mode "fix": the same editor for the given rows, to fix them here or ask Claude to.
 */
export function BuildButton({
  clientId,
  label = 'Build ready ads',
  variant = 'side',
  mode = 'build',
  rows,
  problem,
}: {
  clientId: string;
  label?: string;
  variant?: 'side' | 'link' | 'pill' | 'primary';
  mode?: 'build' | 'fix';
  rows?: number[];
  problem?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<BuildPlan | null>(null);
  const [loading, start] = useTransition();
  const open = () => {
    ref.current?.showModal();
    start(async () => setPlan(await getBuildPlan(clientId, rows)));
  };
  const cls = variant === 'side' ? 'btn btn-sm' : variant === 'primary' ? 'btn' : variant === 'pill' ? 'pill' : 'linkbtn';
  return (
    <>
      <button type="button" className={cls} onClick={open} style={variant === 'side' ? { width: '100%', margin: '6px 0 8px' } : undefined}>
        {variant === 'side' ? <Icon name="plus" size={16} stroke="#fff" width={2} /> : null}
        {label}
        {variant === 'link' ? ' ›' : ''}
      </button>
      <dialog ref={ref} className="panel" aria-label={label} onClose={() => setPlan(null)}>
        {loading || !plan ? (
          <div className="panel-body">
            <p className="eyebrow">Reading the sheet…</p>
          </div>
        ) : !plan.ok ? (
          <div className="panel-body">
            <p className="banner">{plan.error}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
        ) : (
          <PanelContent clientId={clientId} plan={plan} mode={mode} problem={problem} close={() => ref.current?.close()} />
        )}
      </dialog>
    </>
  );
}

function PanelContent({ clientId, plan, mode, problem, close }: { clientId: string; plan: BuildPlan; mode: 'build' | 'fix'; problem?: string; close: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<number, PlanRow['cells']>>(() => Object.fromEntries(plan.rows.map((r) => [r.row, { ...r.cells }])));
  const [selected, setSelected] = useState<Set<number>>(() => new Set(plan.rows.map((r) => r.row)));
  const [bulk, setBulk] = useState<Partial<PlanRow['cells']>>({});
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [sent, setSent] = useState<SendResult | null>(null);

  const campaignNames = plan.campaigns.map((c) => c.name);
  const adSetsFor = (campaign: string) => plan.campaigns.find((c) => c.name === campaign)?.adSets ?? plan.adSets;
  const set = (row: number, col: Col, v: string) => setValues((s) => ({ ...s, [row]: { ...s[row], [col]: v } }));
  const toggle = (row: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(row)) n.delete(row);
      else n.add(row);
      return n;
    });

  const edits: RowEdit[] = useMemo(
    () =>
      plan.rows.flatMap((r) =>
        (Object.keys(r.cells) as Col[])
          .filter((c) => (values[r.row][c] ?? '').trim() !== (r.cells[c] ?? '').trim())
          .map((c) => ({ row: r.row, col: c, expected: r.cells[c], value: values[r.row][c].trim() })),
      ),
    [values, plan.rows],
  );
  const chosen = plan.rows.filter((r) => selected.has(r.row));
  const notReady = chosen.filter((r) => missing(values[r.row]).length);

  const applyBulk = () =>
    setValues((s) => {
      const n = { ...s };
      for (const r of chosen) n[r.row] = { ...n[r.row], ...Object.fromEntries(Object.entries(bulk).filter(([, v]) => v)) };
      return n;
    });

  const finish = () => {
    router.refresh();
  };

  const doSave = () =>
    start(async () => {
      setSent(null);
      setSaved(await saveRowEdits(clientId, edits));
      finish();
    });
  const doBuild = () =>
    start(async () => {
      const r = await submitBuild(clientId, edits, chosen.map((x) => x.row), note);
      setSaved(r.save);
      setSent(r.command);
      finish();
    });
  const doAskFix = () =>
    start(async () => {
      if (edits.length) setSaved(await saveRowEdits(clientId, edits));
      const issue = problem ?? [...new Set(chosen.flatMap((r) => r.problems.map((p) => p.title)))].join('; ');
      setSent(await askClaudeToFix(clientId, chosen.map((x) => x.row), issue, note));
      finish();
    });

  const done = saved || sent;
  if (!plan.rows.length) {
    return (
      <div className="panel-body">
        <h2 className="title" style={{ fontSize: 28 }}>Nothing waiting to build.</h2>
        <p className="muted">
          Rows show up here when column B is “Building in ads manager” and they aren’t built yet. If Claude adds rows while organizing Drive, they appear here too.
        </p>
        <div>
          <button type="button" className="btn btn-outline btn-sm" onClick={close}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <header className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">
            {plan.clientName} · {mode === 'build' ? 'Build ready ads' : 'Fix rows'}
          </span>
          <h2 className="title" style={{ fontSize: 28 }}>
            {mode === 'build' ? `${chosen.length} of ${plan.rows.length} rows selected` : `Rows ${rangeText(plan.rows.map((r) => r.row))}`}
          </h2>
          <span className="small muted">
            {mode === 'build'
              ? 'Choose where each ad goes and fix what’s missing. Saving writes to the sheet; Claude then builds everything PAUSED.'
              : 'Fix it here and save to the sheet, or ask Claude to fix it from what’s in the sheet and Drive.'}
          </span>
        </div>
        <button type="button" className="ghosticon" aria-label="Close" onClick={close}>
          ✕
        </button>
      </header>

      {done ? (
        <section className="stack">
          {saved ? (
            <div className="notice small">
              <strong>{saved.error ? `Couldn’t save: ${saved.error}` : `Saved ${saved.saved} cell${saved.saved === 1 ? '' : 's'} to the sheet ✓`}</strong>
              {saved.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <span key={`${r.row}${r.col}`}>
                    Row {r.row} {COL_NAME[r.col as Col] ?? r.col}:{' '}
                    {'conflict' in r ? `someone changed it in the sheet to “${r.conflict.current}”, so I didn’t overwrite it.` : 'error' in r ? r.error : ''}
                  </span>
                ))}
            </div>
          ) : null}
          {sent ? <CommandOutcome result={sent} /> : null}
          <div className="wrap">
            <button type="button" className="btn btn-sm" onClick={close}>
              Done
            </button>
          </div>
        </section>
      ) : (
        <>
          {mode === 'build' ? (
            <section className="panel-bulk" aria-label="Set for selected rows">
              <span className="small strong">Set for the {chosen.length} selected rows</span>
              <div className="panel-grid">
                <select className="select" value={bulk.AO ?? ''} onChange={(e) => setBulk({ ...bulk, AO: e.target.value })} aria-label="What to do">
                  <option value="">What to do…</option>
                  {plan.actions.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <Pick
                  value={bulk.AP ?? ''}
                  options={campaignNames}
                  free={bulk.AO === 'CREATE NEW CAMPAIGN + NEW AD SET'}
                  placeholder={bulk.AO === 'CREATE NEW CAMPAIGN + NEW AD SET' ? 'New campaign name' : 'Campaign…'}
                  onChange={(v) => setBulk({ ...bulk, AP: v })}
                  label="Campaign"
                />
                <Pick
                  value={bulk.AQ ?? ''}
                  options={adSetsFor(bulk.AP ?? '')}
                  free={!!bulk.AO?.startsWith('CREATE')}
                  placeholder={bulk.AO?.startsWith('CREATE') ? 'New ad set name' : 'Ad set…'}
                  onChange={(v) => setBulk({ ...bulk, AQ: v })}
                  label="Ad set"
                />
                <Pick value={bulk.AR ?? ''} options={plan.adSets} placeholder="Copy settings from ad set…" onChange={(v) => setBulk({ ...bulk, AR: v })} label="Copy settings from (ad set)" />
                <input className="input" placeholder="Daily budget (blank if CBO)" value={bulk.AS ?? ''} onChange={(e) => setBulk({ ...bulk, AS: e.target.value })} aria-label="Daily budget" />
                <button type="button" className="btn btn-outline btn-sm" onClick={applyBulk} disabled={!chosen.length}>
                  Apply
                </button>
              </div>
            </section>
          ) : null}

          {!plan.campaigns.length ? (
            <p className="small muted">No campaigns in META_LIST yet (it lists what has spent in RAW_META), so type the names exactly as in Ads Manager.</p>
          ) : null}

          <div className="panel-table scroll-x">
            <table className="rows">
              <thead>
                <tr>
                  <th scope="col" aria-label="Selected" />
                  <th scope="col">Row</th>
                  <th scope="col">Drive link (Z)</th>
                  <th scope="col">URL (Y)</th>
                  <th scope="col">What to do (AO)</th>
                  <th scope="col">Campaign (AP)</th>
                  <th scope="col">Ad set (AQ)</th>
                  <th scope="col">Copy settings from (AR)</th>
                  <th scope="col" title="Leave blank if the campaign is CBO">Budget (AS) · blank if CBO</th>
                  <th scope="col" title="Leave blank and Claude writes the copy from the creative alone">Copy notes (AV)</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => {
                  const v = values[r.row];
                  const miss = missing(v);
                  return (
                    <tr key={r.row}>
                      <td>
                        <input type="checkbox" checked={selected.has(r.row)} onChange={() => toggle(r.row)} aria-label={`Select row ${r.row}`} />
                      </td>
                      <td style={{ minWidth: 200 }}>
                        <div className="strong" style={{ fontSize: 15 }}>
                          {r.row} · {r.label}
                        </div>
                        <div className="xs muted">{[r.brand, r.adType, r.product].filter(Boolean).join(' · ')}</div>
                        <div className={`xs ${miss.length ? '' : 'muted'}`} style={{ marginTop: 4 }}>
                          {miss.length ? (
                            <span className="status status-fix" style={{ minHeight: 24, padding: '2px 10px', fontSize: 12 }}>
                              Missing: {miss.join(', ')}
                            </span>
                          ) : (
                            <span className="status status-ready" style={{ minHeight: 24, padding: '2px 10px', fontSize: 12 }}>
                              Ready
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ minWidth: 240 }}>
                        <input className="input" type="text" value={v.Z} placeholder="Drive folder link, or creator post ID" onChange={(e) => set(r.row, 'Z', e.target.value)} aria-label={`Drive link row ${r.row}`} />
                        {r.sharedWith.length ? (
                          <div className="xs muted" style={{ marginTop: 4 }}>
                            Same Drive as row{r.sharedWith.length === 1 ? '' : 's'} {rangeText(r.sharedWith)}. Claude organizes the folder first, then makes one row per creative (adds or reports rows as needed).
                          </div>
                        ) : null}
                        {r.driveElsewhere && v.Z !== r.driveElsewhere ? (
                          <button type="button" className="linkbtn xs" style={{ minHeight: 32 }} onClick={() => set(r.row, 'Z', r.driveElsewhere!)}>
                            Use the Drive link found in another column ›
                          </button>
                        ) : null}
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <input className="input" type="url" value={v.Y} placeholder="Blank = Claude proposes one (or homepage)" onChange={(e) => set(r.row, 'Y', e.target.value)} aria-label={`URL row ${r.row}`} />
                      </td>
                      <td style={{ minWidth: 230 }}>
                        <select className="select" value={v.AO} onChange={(e) => set(r.row, 'AO', e.target.value)} aria-label={`What to do row ${r.row}`}>
                          <option value="">—</option>
                          {plan.actions.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <Pick
                          value={v.AP}
                          options={campaignNames}
                          free={v.AO === 'CREATE NEW CAMPAIGN + NEW AD SET'}
                          placeholder={v.AO === 'CREATE NEW CAMPAIGN + NEW AD SET' ? 'New campaign name' : 'Pick a campaign…'}
                          disabled={v.AO === 'SAME AS ROW ABOVE'}
                          onChange={(x) => set(r.row, 'AP', x)}
                          label={`Campaign row ${r.row}`}
                        />
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <Pick
                          value={v.AQ}
                          options={adSetsFor(v.AP)}
                          free={!!v.AO?.startsWith('CREATE')}
                          placeholder={v.AO?.startsWith('CREATE') ? 'New ad set name' : 'Pick an ad set…'}
                          disabled={v.AO === 'SAME AS ROW ABOVE'}
                          onChange={(x) => set(r.row, 'AQ', x)}
                          label={`Ad set row ${r.row}`}
                        />
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <Pick
                          value={v.AR}
                          options={plan.adSets}
                          disabled={!v.AO?.startsWith('CREATE')}
                          placeholder={v.AO?.startsWith('CREATE') ? 'Ad set to copy settings from…' : '— only when creating'}
                          onChange={(x) => set(r.row, 'AR', x)}
                          label={`Copy settings from (ad set) row ${r.row}`}
                        />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <input className="input" value={v.AS} inputMode="decimal" placeholder="blank if CBO" disabled={!v.AO?.startsWith('CREATE')} onChange={(e) => set(r.row, 'AS', e.target.value)} aria-label={`Budget row ${r.row}`} />
                      </td>
                      <td style={{ minWidth: 260 }}>
                        <textarea
                          className="input"
                          rows={2}
                          style={{ borderRadius: 14, padding: 10, minHeight: 44 }}
                          value={v.AV}
                          placeholder="Blank = Claude writes from the creative"
                          onChange={(e) => set(r.row, 'AV', e.target.value)}
                          aria-label={`Copy notes row ${r.row}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="field">
            Instructions for Claude (optional)
            <textarea
              className="input"
              rows={3}
              style={{ borderRadius: 18, padding: 14 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'build' ? 'e.g. use the Spanish copy from last month for rows 85–88' : 'e.g. the Drive links are in the BRIEF column, move them to Z'}
            />
          </label>

          <footer className="row-between" style={{ alignItems: 'center' }}>
            <span className="small muted">
              {edits.length ? `${edits.length} change${edits.length === 1 ? '' : 's'} to save` : 'No changes yet'}
              {mode === 'build' && notReady.length ? ` · ${notReady.length} selected row${notReady.length === 1 ? '' : 's'} still missing something; Claude will skip and report them` : ''}
            </span>
            <div className="wrap" style={{ alignItems: 'center' }}>
              {mode === 'fix' ? (
                <>
                  <button type="button" className="btn btn-outline btn-sm" disabled={pending || !chosen.length} onClick={doAskFix}>
                    {pending ? 'Sending…' : 'Ask Claude to fix these'}
                  </button>
                  <button type="button" className="btn btn-sm" disabled={pending || !edits.length} onClick={doSave}>
                    {pending ? 'Saving…' : 'Save to the sheet'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-outline btn-sm" disabled={pending || !edits.length} onClick={doSave}>
                    Save only
                  </button>
                  <button type="button" className="btn btn-sm" disabled={pending || !chosen.length} onClick={doBuild}>
                    {pending ? 'Sending…' : `Save and build ${chosen.length} ad${chosen.length === 1 ? '' : 's'}`}
                  </button>
                </>
              )}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

/** One click: ask Claude to fix these rows from what's in the sheet and Drive. */
export function AskFixButton({ clientId, rows, problem }: { clientId: string; rows: number[]; problem: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SendResult | null>(null);
  const router = useRouter();
  if (result) return <CommandOutcome result={result} dark />;
  return (
    <button
      type="button"
      className="linkbtn small"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setResult(await askClaudeToFix(clientId, rows, problem));
          router.refresh();
        })
      }
    >
      {pending ? 'Sending…' : 'Ask Claude ›'}
    </button>
  );
}
