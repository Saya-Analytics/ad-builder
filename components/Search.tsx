'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';

export interface SearchItem {
  href: string;
  title: string;
  detail: string;
}

/** ⌘K: jump to a row by number, creative, brand or hook. */
export function Search({ items }: { items: SearchItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.showModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => words.every((w) => `${i.title} ${i.detail}`.toLowerCase().includes(w))).slice(0, 30);
  }, [q, items]);

  const go = (href: string) => {
    ref.current?.close();
    setQ('');
    router.push(href);
  };

  return (
    <>
      <button type="button" className="navbtn" onClick={() => ref.current?.showModal()}>
        <Icon name="search" />
        Search
        <span className="note">⌘ K</span>
      </button>
      <dialog ref={ref} className="search" aria-label="Search rows" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--soft)' }}>
          <Icon name="search" />
          <input
            autoFocus
            className="input"
            style={{ border: 0, paddingLeft: 0 }}
            placeholder="Row, creative, brand or hook"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              if (e.key === 'Enter' && results[active]) go(results[active].href);
            }}
            aria-label="Search"
          />
        </div>
        <div className="search-results">
          {results.length ? (
            results.map((r, i) => (
              <a
                key={r.href}
                href={r.href}
                data-active={i === active}
                onClick={(e) => {
                  e.preventDefault();
                  go(r.href);
                }}
              >
                <span className="strong" style={{ fontSize: 15 }}>
                  {r.title}
                </span>
                <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.detail}
                </span>
              </a>
            ))
          ) : (
            <p className="small muted" style={{ padding: 14 }}>
              Nothing matches.
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
