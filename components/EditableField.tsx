'use client';

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
  const opts = options && options.length ? (options.includes(draft) || !draft ? options : [draft, ...options]) : null;

  return (
    <div className={`field${dark ? ' on-dark' : ''}`} id={id}>
      <label htmlFor={`${id ?? label}-input`}>{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {opts ? (
          <select id={`${id ?? label}-input`} className="select" style={{ flex: '1 1 220px' }} value={draft} onChange={(e) => setDraft(e.target.value)}>
            {!draft ? <option value="">—</option> : null}
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
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
