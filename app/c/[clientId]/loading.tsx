/** Shown while a page reads the sheet, so a click always gets an answer. */
export default function Loading() {
  return (
    <main className="page page-narrow" aria-busy="true">
      <p className="eyebrow">Reading the sheet…</p>
      <div className="card" style={{ height: 120, background: 'var(--parchment)', border: 0 }} />
      <div className="card" style={{ height: 320, background: 'var(--parchment)', border: 0 }} />
    </main>
  );
}
