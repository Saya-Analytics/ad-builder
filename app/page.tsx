import { redirect } from 'next/navigation';
import { activeClients } from '@/lib/data';
import { ConfigError } from '@/components/ConfigError';

export const dynamic = 'force-dynamic';

export default async function Root() {
  let first: string | null = null;
  try {
    first = (await activeClients())[0]?.id ?? null;
  } catch (e) {
    return <ConfigError error={e} />;
  }
  redirect(first ? `/c/${first}` : '/clients');
}
