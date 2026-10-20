import { notFound } from 'next/navigation';
import { activeClients, getClient, loadClientState } from '@/lib/data';
import { driveReachable, serviceAccountEmail } from '@/lib/google';
import { slackOk } from '@/lib/slack';
import { Sidebar } from '@/components/Sidebar';
import { ConfigError } from '@/components/ConfigError';
import { RepairTabsButton } from '@/components/ClientForms';
import { ADDABLE_TABS } from '@/lib/columns';

export const dynamic = 'force-dynamic';

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  let clients;
  try {
    clients = await activeClients();
  } catch (e) {
    return <ConfigError error={e} />;
  }
  const client = await getClient(clientId);
  if (!client) notFound();
  const [loaded, drive, slack] = await Promise.all([
    loadClientState(clientId),
    client.driveRootId ? driveReachable(client.driveRootId) : Promise.resolve(false),
    slackOk(),
  ]);
  const state = loaded.ok ? loaded.state : null;
  const addable = state ? state.missingTabs.filter((t) => (ADDABLE_TABS as readonly string[]).includes(t)) : [];
  const required = state ? state.missingTabs.filter((t) => !(ADDABLE_TABS as readonly string[]).includes(t)) : [];

  return (
    <div className="shell">
      <Sidebar
        client={client}
        clients={clients.some((c) => c.id === client.id) ? clients : [client, ...clients]}
        state={state}
        connections={[
          { name: 'Sheets', ok: loaded.ok },
          { name: 'Drive', ok: drive },
          { name: 'Slack', ok: slack },
        ]}
      />
      <div className="content">
        {!loaded.ok ? (
          <div style={{ padding: '24px 24px 0' }}>
            <p className="banner" role="alert">
              {loaded.kind === 'access'
                ? `Can’t read ${client.name}’s sheet. Share it with ${serviceAccountEmail()}.`
                : /quota/i.test(loaded.error)
                  ? 'Google asked us to slow down (too many sheet reads this minute). Wait a minute and press Refresh.'
                  : `Can’t load ${client.name}: ${loaded.error}`}
            </p>
          </div>
        ) : null}
        {client.status === 'Offboarded' ? (
          <div style={{ padding: '24px 24px 0' }}>
            <p className="notice">{client.name} is offboarded (since {client.offboardedOn || 'unknown'}). Read only.</p>
          </div>
        ) : null}
        {required.length || addable.length ? (
          <div style={{ padding: '24px 24px 0' }}>
            <div className="banner" role="alert">
              <span>Setup incomplete: missing {[...required, ...addable].join(', ')}.</span>
              {addable.length ? <RepairTabsButton clientId={client.id} tabs={addable} /> : null}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
