import { loadClientState } from '@/lib/data';
import { activeRows, brandCounts } from '@/lib/summary';
import { BrandFilter, RowsTable } from '@/components/RowsTable';

export const dynamic = 'force-dynamic';

export default async function Rows({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ brand?: string }> }) {
  const { clientId } = await params;
  const { brand = '' } = await searchParams;
  const loaded = await loadClientState(clientId);
  if (!loaded.ok) return null;
  const s = loaded.state;
  const rows = activeRows(s);
  return (
    <main className="page page-narrow">
      <section className="section">
        <span className="eyebrow">AD APPROVALS · in the build queue or built in the last 3 weeks</span>
        <div className="row-between">
          <h1 className="title">Rows</h1>
          <BrandFilter base={`/c/${clientId}/rows`} brands={brandCounts(s, rows)} current={brand} />
        </div>
        <RowsTable state={s} rows={brand ? rows.filter((r) => r.brand === brand) : rows} />
      </section>
    </main>
  );
}
