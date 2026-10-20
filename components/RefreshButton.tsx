'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshData } from '@/app/actions';

const ICON = 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6';

/** Reads the sheets again now, instead of waiting for the 30-second cache. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState<string | null>(null);
  return (
    <button
      type="button"
      className="navbtn"
      disabled={pending}
      title="Read the sheets again now"
      onClick={() =>
        start(async () => {
          await refreshData();
          router.refresh();
          setAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
        })
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICON} />
      </svg>
      {pending ? 'Refreshing…' : 'Refresh'}
      {at && !pending ? <span className="note">updated {at}</span> : null}
    </button>
  );
}
