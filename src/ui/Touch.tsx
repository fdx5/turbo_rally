import { useEffect, useRef, useState } from 'react';
import { input } from '../core/input';
import { useSettings } from '../core/settings';

/** Landscape touch controls: left stick/buttons, right drift/item/skill/brake/look-back (§14). */
export function TouchControls() {
  const mode = useSettings((s) => s.touchSteer);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // only take over (auto-accelerate etc.) once the player actually touches the screen
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') input.touch.active = true;
    };
    window.addEventListener('pointerdown', onTouch);
    return () => {
      window.removeEventListener('pointerdown', onTouch);
      input.touch.active = false;
      input.touch.steer = 0;
    };
  }, []);
  const stickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId || !stickRef.current) return;
    const r = stickRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 20;
    const l = Math.min(1, Math.hypot(dx, dy) / max);
    const a = Math.atan2(dy, dx);
    setKnob({ x: Math.cos(a) * l * max, y: Math.sin(a) * l * max });
    input.touch.steer = Math.max(-1, Math.min(1, dx / max));
  };
  const hold = (key: 'drift' | 'brake' | 'lookBack') => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input.touch[key] = true;
      if (key === 'drift') input.press('driftPress');
      setOn((o) => ({ ...o, [key]: true }));
    },
    onPointerUp: () => {
      input.touch[key] = false;
      setOn((o) => ({ ...o, [key]: false }));
    },
    onPointerCancel: () => {
      input.touch[key] = false;
      setOn((o) => ({ ...o, [key]: false }));
    },
  });
  const tap = (edge: 'item' | 'skill') => ({
    onPointerDown: () => {
      input.press(edge);
      if ('vibrate' in navigator) navigator.vibrate?.(15);
      setOn((o) => ({ ...o, [edge]: true }));
      setTimeout(() => setOn((o) => ({ ...o, [edge]: false })), 120);
    },
  });
  const steerBtn = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input.touch.steer = dir;
      setOn((o) => ({ ...o, ['s' + dir]: true }));
    },
    onPointerUp: () => {
      input.touch.steer = 0;
      setOn((o) => ({ ...o, ['s' + dir]: false }));
    },
  });
  const P = (l: number | null, r: number | null, b: number, size: number) => ({
    left: l != null ? `calc(${l}px + var(--safe-l))` : undefined,
    right: r != null ? `calc(${r}px + var(--safe-r))` : undefined,
    bottom: `calc(${b}px + var(--safe-b))`,
    width: size,
    height: size,
  });
  return (
    <div className="touch">
      {mode === 'stick' && (
        <div
          ref={stickRef}
          className="pad stick"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            stickId.current = e.pointerId;
            stickMove(e);
          }}
          onPointerMove={stickMove}
          onPointerUp={() => {
            stickId.current = null;
            setKnob({ x: 0, y: 0 });
            input.touch.steer = 0;
          }}
        >
          <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      )}
      {mode === 'buttons' && (
        <>
          <div className={`pad ${on['s-1'] ? 'on' : ''}`} style={P(24, null, 40, 104)} {...steerBtn(-1)}>
            ◀
          </div>
          <div className={`pad ${on.s1 ? 'on' : ''}`} style={P(142, null, 40, 104)} {...steerBtn(1)}>
            ▶
          </div>
        </>
      )}
      {mode === 'tilt' && (
        <div className="pad" style={{ ...P(24, null, 40, 90), fontSize: 16 }}>
          📱 기울기
        </div>
      )}
      <div className={`pad ${on.drift ? 'on' : ''}`} style={P(null, 30, 34, 120)} {...hold('drift')}>
        🌀
        <span style={{ position: 'absolute', bottom: 14, fontSize: 13 }}>드리프트</span>
      </div>
      <div className={`pad ${on.item ? 'on' : ''}`} style={P(null, 160, 120, 84)} {...tap('item')}>
        🎁
      </div>
      <div className={`pad ${on.skill ? 'on' : ''}`} style={P(null, 40, 172, 70)} {...tap('skill')}>
        ⚡
      </div>
      <div className={`pad ${on.brake ? 'on' : ''}`} style={P(null, 168, 26, 72)} {...hold('brake')}>
        🛑
      </div>
      <div className={`pad ${on.lookBack ? 'on' : ''}`} style={{ ...P(null, 260, 30, 56), fontSize: 20 }} {...hold('lookBack')}>
        👀
      </div>
    </div>
  );
}
