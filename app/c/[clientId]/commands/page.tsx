import { loadClientState } from '@/lib/data';
import { setupValue } from '@/lib/setup';
import { commandInterval, trackedCommands } from '@/lib/tracked';
import { CommandTracker } from '@/components/CommandTracker';
import { COMMAND_TYPES } from '@/lib/commands';

export const dynamic = 'force-dynamic';

export default async function Commands({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;
  return (
    <main className="page page-narrow">
      <section className="section">
        <span className="eyebrow">COMMANDS tab · checked every {commandInterval(s)} min by Claude’s scheduled task</span>
        <h1 className="title">Claude requests</h1>
        <p className="sub">Each button leaves a command for Claude: a Slack tag first, a COMMANDS row always. Claude writes back running, done or failed.</p>
      </section>
      <div className="card" style={{ padding: '8px 24px', gap: 0 }}>
        <CommandTracker clientId={clientId} initial={await trackedCommands(s, 50)} limit={50} chatLink={setupValue(s.setup, 'claudeChat') || undefined} />
      </div>
      <details className="notice small">
        <summary>Command reference</summary>
        <ul>
          {Object.entries(COMMAND_TYPES).map(([k, v]) => (
            <li key={k}>
              <strong>{k}</strong> · {v}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
