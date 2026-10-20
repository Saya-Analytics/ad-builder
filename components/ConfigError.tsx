import { serviceAccountEmail } from '@/lib/google';

/** Shown when the master sheet can't be read: env missing or not shared. */
export function ConfigError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate limit/i.test(message)) {
    return (
      <main className="page page-narrow" style={{ maxWidth: 760 }}>
        <h1 className="title">Google asked us to slow down.</h1>
        <p>Google allows a limited number of sheet reads per minute. Wait a minute and reload the page.</p>
      </main>
    );
  }
  return (
    <main className="page page-narrow" style={{ maxWidth: 760 }}>
      <h1 className="title">Can’t read the master sheet.</h1>
      <p className="banner" role="alert">{message}</p>
      <p>
        Check that <code>MASTER_SHEET_ID</code> is set in Vercel and that the AD BUILDER CLIENTS sheet is shared with{' '}
        <strong>{serviceAccountEmail()}</strong> as Editor.
      </p>
    </main>
  );
}
