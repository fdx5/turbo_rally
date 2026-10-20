/**
 * Hand-built SVG icon set (thick ink outline, flat pastel fills) used instead of emoji so the
 * menus read as one consistent game UI.
 */
const INK = '#3d2c4e';
type P = { size?: number; color?: string };
const S = ({ size = 28, children, vb = 32 }: { size?: number; children: React.ReactNode; vb?: number }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flex: 'none' }}>
    {children}
  </svg>
);
export const Icon = {
  flag: ({ size, color = '#fff' }: P) => (
    <S size={size}>
      <path d="M7 28V5" />
      <path d="M7 5h17l-3.5 5.5L24 16H7" fill={color} />
      <path d="M11 5v11M15 5v11M19 5v11" strokeWidth={0} />
      <rect x="7" y="5" width="4.3" height="5.5" fill={INK} stroke="none" />
      <rect x="15.6" y="5" width="4.3" height="5.5" fill={INK} stroke="none" />
      <rect x="11.3" y="10.5" width="4.3" height="5.5" fill={INK} stroke="none" />
    </S>
  ),
  timer: ({ size, color = '#a2d2ff' }: P) => (
    <S size={size}>
      <circle cx="16" cy="18" r="10" fill={color} />
      <path d="M16 18l4-4M13 4h6M16 4v4M25 9l2-2" />
    </S>
  ),
  car: ({ size, color = '#b9fbc0' }: P) => (
    <S size={size}>
      <path d="M4 21v-4l3-6h13l5 6h2v4z" fill={color} />
      <path d="M9 11l-1 5h12l-3-5" fill="#fff" />
      <circle cx="10" cy="22" r="3.4" fill="#fff" />
      <circle cx="22" cy="22" r="3.4" fill="#fff" />
    </S>
  ),
  bag: ({ size, color = '#ffd6a5' }: P) => (
    <S size={size}>
      <path d="M6 11h20l-2 16H8z" fill={color} />
      <path d="M11 11V9a5 5 0 0110 0v2" />
    </S>
  ),
  target: ({ size, color = '#ffadad' }: P) => (
    <S size={size}>
      <circle cx="16" cy="16" r="11" fill={color} />
      <circle cx="16" cy="16" r="6.5" fill="#fff" />
      <circle cx="16" cy="16" r="2.3" fill={INK} />
    </S>
  ),
  calendar: ({ size, color = '#fdffb6' }: P) => (
    <S size={size}>
      <rect x="5" y="7" width="22" height="20" rx="4" fill={color} />
      <path d="M5 13h22M11 4v6M21 4v6" />
      <path d="M11 19l3 3 6-6" />
    </S>
  ),
  wheel: ({ size, color = '#cdb4db' }: P) => (
    <S size={size}>
      <circle cx="16" cy="16" r="11" fill={color} />
      <path d="M16 5v22M5 16h22M8.2 8.2l15.6 15.6M23.8 8.2L8.2 23.8" strokeWidth={1.8} />
      <circle cx="16" cy="16" r="3" fill="#fff" />
    </S>
  ),
  gear: ({ size, color = '#e9e1f2' }: P) => (
    <S size={size}>
      <path d="M16 4l2.5 3.2 4-.6.6 4 3.2 2.5-2 3.4 2 3.4-3.2 2.5-.6 4-4-.6L16 28l-2.5-3.2-4 .6-.6-4-3.2-2.5 2-3.4-2-3.4 3.2-2.5.6-4 4 .6z" fill={color} />
      <circle cx="16" cy="16" r="4" fill="#fff" />
    </S>
  ),
  user: ({ size, color = '#ffc8dd' }: P) => (
    <S size={size}>
      <circle cx="16" cy="12" r="6" fill={color} />
      <path d="M6 27c1-6 5-8 10-8s9 2 10 8z" fill={color} />
    </S>
  ),
  chart: ({ size, color = '#a2d2ff' }: P) => (
    <S size={size}>
      <rect x="5" y="16" width="5" height="10" rx="1.5" fill={color} />
      <rect x="13.5" y="9" width="5" height="17" rx="1.5" fill="#ffc8dd" />
      <rect x="22" y="12" width="5" height="14" rx="1.5" fill="#b9fbc0" />
    </S>
  ),
  coin: ({ size }: P) => (
    <S size={size}>
      <circle cx="16" cy="16" r="11" fill="#ffd45e" />
      <circle cx="16" cy="16" r="7" stroke="#d9a400" />
      <path d="M16 12v8" stroke="#d9a400" />
    </S>
  ),
  star: ({ size, color = '#ffd45e' }: P) => (
    <S size={size}>
      <path d="M16 4l3.6 7.4 8.1 1.1-5.9 5.6 1.4 8L16 22.3 8.8 26.1l1.4-8-5.9-5.6 8.1-1.1z" fill={color} />
    </S>
  ),
  back: ({ size }: P) => (
    <S size={size}>
      <path d="M19 7l-9 9 9 9" strokeWidth={3.4} />
    </S>
  ),
  play: ({ size, color = '#fff' }: P) => (
    <S size={size}>
      <path d="M10 6l16 10-16 10z" fill={color} />
    </S>
  ),
  lock: ({ size, color = '#ffd6a5' }: P) => (
    <S size={size}>
      <rect x="7" y="14" width="18" height="13" rx="3" fill={color} />
      <path d="M11 14v-3a5 5 0 0110 0v3" />
    </S>
  ),
  trophy: ({ size, color = '#ffd45e' }: P) => (
    <S size={size}>
      <path d="M10 5h12v7a6 6 0 01-12 0z" fill={color} />
      <path d="M10 8H6a4 4 0 004 5M22 8h4a4 4 0 01-4 5M16 18v4M11 27h10l-1-5h-8z" />
    </S>
  ),
  gift: ({ size, color = '#ffadad' }: P) => (
    <S size={size}>
      <rect x="5" y="12" width="22" height="15" rx="2" fill={color} />
      <rect x="4" y="9" width="24" height="5" rx="1.5" fill="#fff" />
      <path d="M16 9v18M16 9c-3-5-8-4-6-1M16 9c3-5 8-4 6-1" />
    </S>
  ),
  home: ({ size, color = '#b9fbc0' }: P) => (
    <S size={size}>
      <path d="M5 15L16 5l11 10v12H5z" fill={color} />
      <rect x="13" y="19" width="6" height="8" fill="#fff" />
    </S>
  ),
  retry: ({ size }: P) => (
    <S size={size}>
      <path d="M25 16a9 9 0 11-3-6.7" strokeWidth={3.2} />
      <path d="M23 4v6h-6" strokeWidth={3.2} />
    </S>
  ),
  pause: ({ size }: P) => (
    <S size={size}>
      <rect x="9" y="7" width="5" height="18" rx="1.5" fill="#fff" />
      <rect x="18" y="7" width="5" height="18" rx="1.5" fill="#fff" />
    </S>
  ),
};
export type IconName = keyof typeof Icon;
export function I({ name, size, color }: { name: IconName; size?: number; color?: string }) {
  const C = Icon[name];
  return <C size={size} color={color} />;
}
