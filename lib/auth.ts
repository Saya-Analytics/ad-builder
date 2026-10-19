import 'server-only';
import { headers } from 'next/headers';

/** The Basic-auth username, recorded as "by" on commands. */
export async function currentUser(): Promise<string> {
  const h = (await headers()).get('authorization') ?? '';
  if (!h.startsWith('Basic ')) return 'app';
  return Buffer.from(h.slice(6), 'base64').toString('utf8').split(':')[0] || 'app';
}
