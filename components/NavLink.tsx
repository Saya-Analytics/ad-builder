'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

export function NavLink({ href, icon, label, note, exact }: { href: string; icon: IconName; label: string; note?: string; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return (
    <Link prefetch={false} href={href} className="navbtn" aria-current={active ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {note ? <span className="note">{note}</span> : null}
    </Link>
  );
}
