import Link from 'next/link';
import type { ApprovalRow, RowState } from '@/lib/approvals';
import { copyCode } from '@/lib/approvals';
import type { ClientState } from '@/lib/data';

export const STATE_LABEL: Record<RowState, string> = { ready: 'Ready', fix: 'Fix', built: 'Built ✓', other: '' };

export function statusChip(state: RowState, problems: { title: string }[], status: string) {
  if (state === 'fix') {
    const p = problems[0]?.title ?? 'Fix';
    return /link|url|video .* url/i.test(p) ? 'Fix link' : 'Fix';
  }
  return state === 'other' ? status : STATE_LABEL[state];
}

const hookText = (v: string) => v.split(' · ').slice(1).join(' · ') || v;

export function BrandFilter({ base, brands, current }: { base: string; brands: { brand: string; n: number }[]; current: string }) {
  const all = brands.reduce((n, b) => n + b.n, 0);
  return (
    <div className="wrap">
      <Link href={base} className="pill" aria-pressed={!current}>
        All · {all}
      </Link>
      {brands
        .filter((b) => b.n)
        .map((b) => (
          <Link key={b.brand} href={`${base}?brand=${encodeURIComponent(b.brand)}`} className="pill" aria-pressed={current === b.brand}>
            {b.brand} · {b.n}
          </Link>
        ))}
    </div>
  );
}

export function RowsTable({ state, rows }: { state: ClientState; rows: ApprovalRow[] }) {
  const base = `/c/${state.client.id}`;
  if (!rows.length) {
    return <p className="notice small">No rows in “Building in ads manager” and nothing built in the last 3 weeks.</p>;
  }
  return (
    <div className="tablecard">
      <div className="scroll-x">
        <table className="rows">
          <thead>
            <tr>
              <th scope="col">Creative</th>
              <th scope="col">Row</th>
              <th scope="col">Hook</th>
              <th scope="col">Copy</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = state.status.get(r.row)!;
              return (
                <tr key={r.row}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="thumb" aria-hidden="true" />
                      <div style={{ minWidth: 0 }}>
                        <Link href={`${base}/rows/${r.row}`} className="strong" style={{ fontSize: 15, color: 'var(--ink)' }}>
                          {r.differentiation || r.adId || `Row ${r.row}`}
                        </Link>
                        <div className="xs muted">{[r.brand, r.product].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small muted">{r.row}</td>
                  <td className="small" style={{ color: 'var(--secondary)', maxWidth: 320 }}>
                    {r.hook ? `“${hookText(r.hook)}”` : <span className="muted">—</span>}
                  </td>
                  <td className="small">{r.copySet ? copyCode(r.copySet) : <span className="muted">Claude writes</span>}</td>
                  <td>
                    <Link href={`${base}/rows/${r.row}`} className={`status status-${st.state}`} title={st.problems.map((p) => p.title).join('\n') || undefined}>
                      {statusChip(st.state, st.problems, r.status)}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
