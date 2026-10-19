import { loadClientState } from '@/lib/data';
import { SETUP_FIELDS, SETUP_HINTS, type SetupKey } from '@/lib/setup';
import { a1, TABS } from '@/lib/columns';
import { dropdownOptions } from '@/lib/google';
import { writeSetupCell } from '@/app/actions';
import { EditableField } from '@/components/EditableField';
import { AddBrandForm, RepairTabsButton } from '@/components/ClientForms';
import { WEEKDAYS } from '@/lib/summary';

export const dynamic = 'force-dynamic';

export default async function Settings({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;

  if (!s.setup) {
    return (
      <main className="page page-narrow">
        <h1 className="title">Settings</h1>
        <div className="notice">
          <span>This sheet has no CLAUDE SETUP tab, so Claude falls back to the config written in its skill.</span>
          <RepairTabsButton clientId={clientId} tabs={[TABS.setup]} />
        </div>
      </main>
    );
  }

  // Column B's dropdown in AD APPROVALS gives the choices for "Status after Claude builds".
  const firstRow = s.rows[0]?.row ?? 6;
  const statusOptions = await dropdownOptions(s.client.sheetId, a1(TABS.approvals, `B${firstRow}`)).catch(() => []);
  const options: Partial<Record<SetupKey, string[]>> = { buildDay: WEEKDAYS, afterBuildStatus: statusOptions };

  return (
    <main className="page page-narrow">
      <section className="section" style={{ gap: 6 }}>
        <span className="eyebrow">CLAUDE SETUP tab · the yellow cells</span>
        <h1 className="title">Settings</h1>
        <span className="sub">Claude and the app read these by label. Changes save straight to the sheet.</span>
      </section>

      <section className="card">
        <div className="grid-cards" style={{ gap: 20 }}>
          {(Object.keys(SETUP_FIELDS) as SetupKey[]).map((k) => {
            const f = s.setup!.fields[k];
            if (!f) {
              return (
                <div key={k} className="field" id={k}>
                  <span>{SETUP_FIELDS[k]}</span>
                  <span className="small muted">No “{SETUP_FIELDS[k]}” row in CLAUDE SETUP. Add it in column A of the sheet.</span>
                </div>
              );
            }
            return (
              <EditableField
                key={k}
                id={k}
                label={SETUP_FIELDS[k]}
                value={f.value}
                options={options[k]}
                hint={SETUP_HINTS[k]}
                type={k === 'claudeChat' ? 'url' : 'text'}
                save={writeSetupCell.bind(null, clientId, f.row)}
              />
            );
          })}
        </div>
      </section>

      <section className="card" id="brands">
        <div className="row-between">
          <h2 className="h2">Meta ad accounts</h2>
          <span className="small muted">One per brand. Two accounts with the same name? Put the right act_ here.</span>
        </div>
        {s.setup.brands.length ? (
          <div className="grid-cards" style={{ gap: 20 }}>
            {s.setup.brands.map((b) => (
              <EditableField
                key={b.row}
                id={`brand-${b.row}`}
                label={b.brand}
                value={b.account}
                placeholder="act_…"
                hint={b.confirmed ? 'Confirmed' : b.candidates.length > 1 ? `Not confirmed: pick one of ${b.candidates.join(', ')}` : 'No ad account yet'}
                save={writeSetupCell.bind(null, clientId, b.row)}
              />
            ))}
          </div>
        ) : (
          <p className="small muted">No brands yet.</p>
        )}
        <AddBrandForm clientId={clientId} />
      </section>
    </main>
  );
}
