/** TURBO RALLY wordmark: slanted two-tone lettering with ink outline, hard shadow and speed stripes. */
export function Logo({ width = 460 }: { width?: number }) {
  const txt = (y: number, s: string, fill: string, size: number) => (
    <g transform={`translate(0 ${y}) skewX(-10)`}>
      <text x="24" y="0" fontFamily="'Black Han Sans', 'Jua', sans-serif" fontSize={size} letterSpacing="2" fill="#1E2B4A" stroke="#1E2B4A" strokeWidth="16" strokeLinejoin="round" transform="translate(0 9)">
        {s}
      </text>
      <text x="24" y="0" fontFamily="'Black Han Sans', 'Jua', sans-serif" fontSize={size} letterSpacing="2" fill={fill} stroke="#1E2B4A" strokeWidth="9" strokeLinejoin="round" paintOrder="stroke fill">
        {s}
      </text>
      <text x="24" y="0" fontFamily="'Black Han Sans', 'Jua', sans-serif" fontSize={size} letterSpacing="2" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" transform="translate(-2 -3)" clipPath="url(#topHalf)">
        {s}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 460 250" width={width} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id="topHalf">
          <rect x="-50" y="-120" width="600" height="80" />
        </clipPath>
      </defs>
      {/* speed stripes */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-20 - i * 18} y={52 + i * 22} width={60 - i * 12} height="10" rx="5" fill={['#FF5A36', '#ffc83d', '#3f9cff'][i]} stroke="#1E2B4A" strokeWidth="3" />
      ))}
      {txt(108, 'TURBO', '#FF5A36', 118)}
      {txt(226, 'RALLY', '#ffc83d', 118)}
      {/* checkered sticker */}
      <g transform="translate(418 128) rotate(14) scale(0.8)">
        <rect x="0" y="0" width="54" height="40" rx="6" fill="#fff" stroke="#1E2B4A" strokeWidth="4" />
        {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => ((c + r) % 2 === 0 ? <rect key={`${c}${r}`} x={4 + c * 11.5} y={4 + r * 10.7} width="11.5" height="10.7" fill="#1E2B4A" /> : null)))}
      </g>
    </svg>
  );
}
