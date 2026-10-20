'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ComboOption {
  name: string;
  /** Spent in the last few days of RAW_META. */
  live?: boolean;
  /** Last date with spend (YYYY-MM-DD). */
  last?: string;
}

const shortDate = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

/**
 * Searchable picker for campaigns and ad sets: type to filter, live ones first with a green dot,
 * and "Use … as typed" for names that aren't listed yet (Claude creates them).
 */
export function Combo({
  value,
  options,
  onChange,
  label,
  placeholder,
  disabled,
  allowNew = true,
}: {
  value: string;
  options: ComboOption[];
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  allowNew?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [liveOnly, setLiveOnly] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const anyLive = options.some((o) => o.live);
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter((o) => (!liveOnly || o.live) && words.every((w) => o.name.toLowerCase().includes(w))).slice(0, 80);
  }, [options, query, liveOnly]);
  const typed = query.trim();
  const canUseTyped = allowNew && typed && !options.some((o) => o.name.toLowerCase() === typed.toLowerCase());
  const total = shown.length + (canUseTyped ? 1 : 0);

  const place = () => {
    const r = input.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 320) });
  };
  const show = () => {
    if (disabled) return;
    setQuery('');
    setActive(0);
    place();
    setOpen(true);
  };
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    input.current?.blur();
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open]);

  return (
    <span className="combo">
      <input
        ref={input}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        disabled={disabled}
        placeholder={open ? 'Search…' : placeholder}
        value={open ? query : value}
        onFocus={show}
        onClick={() => !open && show()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, total - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active < shown.length) pick(shown[active].name);
            else if (canUseTyped) pick(typed);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && pos ? (
        <div className="combo-list" id={`${id}-list`} role="listbox" style={{ top: pos.top, left: pos.left, width: pos.width }} onMouseDown={(e) => e.preventDefault()}>
          {anyLive ? (
            <label className="combo-filter xs">
              <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} /> Live only
            </label>
          ) : null}
          {shown.map((o, i) => (
            <button
              key={o.name}
              type="button"
              role="option"
              aria-selected={o.name === value}
              className={`combo-item${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.name)}
            >
              <span className={`combo-dot${o.live ? ' on' : ''}`} aria-hidden="true" />
              <span className="combo-name">{o.name}</span>
              <span className="combo-note">{o.live ? 'live' : o.last ? `last spend ${shortDate(o.last)}` : 'no spend'}</span>
            </button>
          ))}
          {canUseTyped ? (
            <button type="button" className={`combo-item${active === shown.length ? ' is-active' : ''}`} onMouseEnter={() => setActive(shown.length)} onClick={() => pick(typed)}>
              <span className="combo-dot" aria-hidden="true" />
              <span className="combo-name">Use “{typed}” as typed</span>
              <span className="combo-note">new / not in RAW_META</span>
            </button>
          ) : null}
          {!total ? <div className="combo-empty xs muted">{options.length ? 'No match.' : 'Nothing in META_LIST yet. Type the exact name.'}</div> : null}
        </div>
      ) : null}
    </span>
  );
}
