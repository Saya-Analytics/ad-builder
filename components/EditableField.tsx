'use client';
import { Combo, type ComboOption } from './Combo';

import { useEffect, useState, useTransition } from 'react';
import type { WriteResult } from '@/lib/writes';

/**
 * One sheet cell. Saves through a server action that re-reads the cell first;
 * if someone changed it meanwhile, both values are shown and the user picks.
 */
export function EditableField({
  label,
  value,
  options,
  save,
  type = 'text',
  dark,
  hint,
  allowOther,
  searchOptions,
  id,
  placeholder,
}: {
  label: string;
  value: string;
  options?: string[];
  save: (expected: string, value: string) => Promise<WriteResult>;
  type?: 'text' | 'url';
  dark?: boolean;
  hint?: string;
  /** Searchable picker (campaigns / ad sets) instead of a plain dropdown. */
  searchOptions?: ComboOption[];
  /** Adds “Type a different name…” to the dropdown (for names Claude will create). */
  allowOther?: boolean;
  id?: string;
  placeholder?: string;
}) {
  const [base, setBase] = useState(value); // what we believe the sheet holds
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ current: string; attempted: string } | null>(null);

  useEffect(() => {
    setBase(value);
    setDraft(value);
  }, [value]);

  const run = (expected: string, next: string) =>
    start(async () => {
      setMsg(null);
      const r = await save(expected, next);
      if (r.ok) {
        setBase(next);
        setConflict(null);
        setMsg('Saved to the sheet ✓');
      } else if ('conflict' in r) {
        setConflict(r.conflict);
      } else {
        setMsg(r.error);
      }
    });

  const dirty = draft.trim() !== base.trim();
  const [typing, setTyping] = useState(false);
  const opts = !typing && options && options.length ? (options.includes(draft) || !draft ? options : [draft, ...options]) : null;

  return (
    <div className={`field${dark ? ' on-dark' : ''}`} id={id}>
      <label htmlFor={`${id ?? label}-input`}>{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {searchOptions?.length ? (
          <span style={{ flex: '1 1 220px' }}>
            <Combo value={draft} options={searchOptions} onChange={setDraft} label={label} placeholder="Search or type…" />
          </span>
        ) : opts ? (
          <select autoComplete="off" id={`${id ?? label}-input`} className="select" style={{ flex: '1 1 220px' }} value={draft} onChange={(e) => (e.target.value === '__other__' ? setTyping(true) : setDraft(e.target.value))}>
            {!draft ? <option value="">—</option> : null}
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {allowOther ? <option value="__other__">✎ Type a different name…</option> : null}
          </select>
        ) : (
          <input
            autoComplete="off"
            id={`${id ?? label}-input`}
            className="input"
            style={{ flex: '1 1 220px' }}
            type={type}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
        {dirty ? (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(base, draft)}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        ) : null}
      </div>
      {hint ? <span className="xs muted">{hint}</span> : null}
      {msg ? (
        <span className="small" role="status">
          {msg}
        </span>
      ) : null}
      {conflict ? (
        <div className={dark ? 'small' : 'notice small'} role="alert">
          <strong>Someone changed this in the sheet.</strong>
          <span>Sheet now: “{conflict.current || '(empty)'}”</span>
          <span>Yours: “{conflict.attempted || '(empty)'}”</span>
          <span className="wrap">
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(conflict.current, conflict.attempted)}>
              Keep mine
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setBase(conflict.current);
                setDraft(conflict.current);
                setConflict(null);
              }}
            >
              Keep the sheet’s
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
