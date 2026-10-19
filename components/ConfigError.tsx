import { serviceAccountEmail } from '@/lib/google';

/** Shown when the master sheet can't be read: env missing or not shared. */
export function ConfigError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="page page-narrow" style={{ maxWidth: 760 }}>
      <h1 className="title">Can’t read the master sheet.</h1>
      <p className="banner" role="alert">{message}</p>
      <p>
        Set <code>MASTER_SHEET_ID</code> and <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> in the Vercel environment, and share the
        AD BUILDER CLIENTS sheet with <strong>{serviceAccountEmail()}</strong> as Editor.
      </p>
    </main>
  );
}
