import { NextResponse } from 'next/server';
import { loadClientState } from '@/lib/data';
import { trackedCommands } from '@/lib/tracked';

export const dynamic = 'force-dynamic';

/** Polled by CommandTracker while a command is open. */
export async function GET(_: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.kind === 'access' ? 403 : 500 });
  return NextResponse.json({ commands: await trackedCommands(loaded.state) });
}
