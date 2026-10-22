import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../game/app';
import { useProfile } from '../net/profileStore';
import { I } from './icons';
import { audio } from '../audio/engine';
import { xpToNext } from '../../shared/economy';
import { TRACKS, type TrackDef } from '../data/tracks';
import { THEMES } from '../tracks/themes';
import { buildPaths } from '../tracks/trackBuilder';
import { Vector3 } from 'three';

export const sfx = {
  click: () => audio.play('uiClick'),
  back: () => audio.play('uiBack'),
  error: () => audio.play('uiError'),
};

export function GoldChip({ big }: { big?: boolean }) {
  const gold = useProfile((s) => s.profile.gold);
  const shown = useCountUp(gold, 600);
  return (
    <div className="tag" style={big ? { fontSize: 22 } : undefined}>
      <I name="coin" size={big ? 28 : 24} />
      {shown.toLocaleString()}
    </div>
  );
}
export function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (target - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function LevelBar() {
  const { level, xp } = useProfile((s) => s.profile);
  const need = xpToNext(level);
  return (
    <div className="chip" title={`${xp}/${need} XP`}>
      <b style={{ color: '#2F6FDB' }}>Lv.{level}</b>
      <div style={{ width: 90, height: 10, background: '#E3ECF7', borderRadius: 6, overflow: 'hidden' }}>
        <div
          style={{
            width: `${(xp / need) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg,#BFDDFF,#2F6FDB)',
          }}
        />
      </div>
    </div>
  );
}
export function TopBar({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const back = useApp((s) => s.back);
  return (
    <div className="topbar">
      <button
        className="btn icon ghost"
        onClick={() => {
          sfx.back();
          (onBack ?? back)();
        }}
        aria-label="뒤로"
      >
        <I name="back" size={26} />
      </button>
      <h1>{title}</h1>
      <div className="spacer" />
      {right}
      <GoldChip />
    </div>
  );
}
export function Modal({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-bg" onClick={() => onClose?.()}>
      <div
        className="panel modal pop-in"
        style={wide ? { width: 'min(760px, 94vw)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
export function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: -2 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ filter: i < n ? 'none' : 'grayscale(1) opacity(0.35)' }}>
          ⭐
        </span>
      ))}
    </span>
  );
}

const trackImgCache = new Map<string, string>();
/** Stylised track card: theme gradient + track outline. */
export function trackImage(t: TrackDef, w = 360, h = 200): string {
  const key = t.id + w;
  const hit = trackImgCache.get(key);
  if (hit) return hit;
  const th = THEMES[t.theme];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, th.sky.top);
  grd.addColorStop(0.6, th.sky.horizon);
  grd.addColorStop(1, th.ground[0]);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.ellipse((i * 73) % w, 30 + (i % 3) * 18, 34, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  const { main: p, shortcuts } = buildPaths(t);
  const mapPoint = new Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const path of [p, ...shortcuts])
    for (let i = 0; i < path.n; i++) {
      path.pointAt(i * path.ds, 0, mapPoint);
      minX = Math.min(minX, mapPoint.x);
      maxX = Math.max(maxX, mapPoint.x);
      minZ = Math.min(minZ, mapPoint.z);
      maxZ = Math.max(maxZ, mapPoint.z);
    }
  const s = Math.min((w - 40) / (maxX - minX), (h - 40) / (maxZ - minZ));
  const ox = (w - (maxX - minX) * s) / 2 - minX * s;
  const oz = (h - (maxZ - minZ) * s) / 2 - minZ * s;
  const path = () => {
    g.beginPath();
    for (let i = 0; i < p.n; i += 3) {
      p.pointAt(i * p.ds, 0, mapPoint);
      const x = mapPoint.x * s + ox;
      const y = mapPoint.z * s + oz;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  };
  g.lineJoin = 'round';
  path();
  g.lineWidth = 16;
  g.strokeStyle = 'rgba(74,59,82,0.25)';
  g.stroke();
  path();
  g.lineWidth = 11;
  g.strokeStyle = th.curb[0];
  g.stroke();
  path();
  g.lineWidth = 6;
  g.strokeStyle = th.road.rainbow ? '#FFFFFF' : th.road.base;
  g.stroke();
  for (const branch of shortcuts) {
    g.beginPath();
    for (let i = 0; i < branch.n; i += 3) {
      const x = branch.px[i] * s + ox,
        y = branch.pz[i] * s + oz;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 5;
    g.strokeStyle = '#253C56';
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeStyle = '#FFE477';
    g.stroke();
  }
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(p.px[0] * s + ox, p.pz[0] * s + oz, 6, 0, Math.PI * 2);
  g.fill();
  const url = c.toDataURL();
  trackImgCache.set(key, url);
  return url;
}
export const trackNo = (id: string) => TRACKS.findIndex((t) => t.id === id) + 1;
export function fmtMs(ms: number) {
  if (!ms || !isFinite(ms)) return '-';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
