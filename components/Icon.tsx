const PATHS = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  rows: 'M4 6h16M4 12h16M4 18h16',
  builds: 'M12 3v12M6 9l6 6 6-6M4 21h16',
  clients: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  commands: 'M8 10h8M8 14h5M4 4h16v13H8l-4 4z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  send: 'M12 19V5M5 12l7-7 7 7',
  spark: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  chevron: 'M6 9l6 6 6-6',
  sheet: 'M5 3h14v18H5zM5 9h14M5 15h14M11 3v18',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, stroke = 'currentColor', width = 1.8 }: { name: IconName; size?: number; stroke?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
