import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { input } from '../core/input';
import { useSettings } from '../core/settings';
import type { TouchAction } from '../core/touchInput';
import { useHud } from './hudStore';
import { ALL_ITEMS } from '../data/items';

/** Two thumb controls. Each pointer owns its action until release, cancel or capture loss. */
export function TouchControls() {
  const mode = useSettings((s) => s.touchSteer);
  const autoAccel = useSettings((s) => s.autoAccel);
  const scale = useSettings((s) => s.touchScale);
  const toggle = useSettings((s) => s.touchDriftToggle);
  const phase = useHud((s) => s.phase);
  const paused = useHud((s) => s.paused);
  const itemId = useHud((s) => s.items[0]);
  const roulette = useHud((s) => s.rouletteIcon);
  const sealed = useHud((s) => s.sealed);
  const gauge = useHud((s) => s.gauge);
  const skillIcon = useHud((s) => s.skillIcon);
  const raceMode = useHud((s) => s.mode);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [tiltMessage, setTiltMessage] = useState('');
  const zoneRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; x: number; y: number; radius: number } | null>(null);
  const racing = phase === 'race' || phase === 'finish';
  const countdown = phase === 'countdown';

  const sync = () =>
    setOn({
      drift: input.touch.drift,
      brake: input.touch.brake,
      accel: input.touch.accel,
      lookBack: input.touch.lookBack,
      left: input.touch.steer < 0,
      right: input.touch.steer > 0,
    });
  const centreStick = () => {
    stick.current = null;
    if (stickRef.current) {
      stickRef.current.style.left = '50%';
      stickRef.current.style.top = '50%';
      stickRef.current.classList.remove('engaged');
    }
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  };
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const reset = () => {
      input.reset();
      centreStick();
      setOn({});
      input.touch.active = !document.hidden && !useHud.getState().paused;
    };
    const visible = () => {
      if (document.hidden) reset();
    };
    const resize = () => {
      if (Math.abs(window.innerWidth - lastWidth) > 20) reset();
      lastWidth = window.innerWidth;
    };
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visible);
    reset();
    input.touch.active = true;
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visible);
      input.reset();
    };
  }, [mode, toggle]);
  useEffect(() => {
    input.reset();
    centreStick();
    setOn({});
    input.touch.active = !paused;
  }, [paused]);
  useEffect(() => {
    if (racing && !paused) input.touch.active = true;
  }, [phase, paused]);

  const capture = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    input.touch.active = true;
    input.press('any');
  };
  const release = (e: ReactPointerEvent<HTMLElement>) => {
    input.touch.release(e.pointerId);
    if (stick.current?.id === e.pointerId) centreStick();
    sync();
  };
  const holding = (action: TouchAction) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      capture(e);
      if (action === 'drift' && toggle) {
        input.touch.toggleDrift();
        if (input.touch.drift) input.press('driftPress');
      } else if (input.touch.hold(e.pointerId, action) && action === 'drift') input.press('driftPress');
      sync();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
  });
  const tapping = (action: 'item' | 'skill') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      capture(e);
      input.press(action);
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
  });
  const moveStick = (e: ReactPointerEvent<HTMLDivElement>) => {
    const current = stick.current;
    if (!current || current.id !== e.pointerId) return;
    const dx = e.clientX - current.x,
      dy = e.clientY - current.y;
    const length = Math.hypot(dx, dy);
    const factor = length > current.radius ? current.radius / length : 1;
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
    input.touch.moveStick(e.pointerId, dx / current.radius);
  };
  const beginStick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stick.current || !input.touch.hold(e.pointerId, 'stick')) return;
    capture(e);
    const rect = zoneRef.current!.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.28;
    const x = Math.max(radius, Math.min(rect.width - radius, e.clientX - rect.left));
    const y = Math.max(radius, Math.min(rect.height - radius, e.clientY - rect.top));
    // Actual landing position is the input origin, so a new touch never jumps the steering.
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY, radius };
    if (stickRef.current) {
      stickRef.current.style.left = `${x}px`;
      stickRef.current.style.top = `${y}px`;
      stickRef.current.classList.add('engaged');
    }
  };
  const enableTilt = async () => {
    if (await input.enableTilt()) setTiltMessage('지금 각도가 중앙이에요');
    else setTiltMessage('기울기를 사용할 수 없어요. 아래 스틱을 이용해 주세요');
  };
  const style = { '--touch-scale': scale, '--skill-progress': `${Math.min(100, gauge)}%` } as CSSProperties;
  return (
    <div
      className="touch"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="터치 운전 조작"
    >
      <div className="touch-steering">
        {mode !== 'buttons' ? (
          <div
            ref={zoneRef}
            className="steering-zone"
            aria-label="조향 스틱"
            onPointerDown={beginStick}
            onPointerMove={moveStick}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
          >
            <div ref={stickRef} className="steering-ring">
              <span className="steering-arrows">‹ &nbsp; &nbsp; ›</span>
              <div ref={knobRef} className="steering-knob" />
            </div>
            <span className="steering-caption">좌우로 밀어 조향</span>
          </div>
        ) : (
          <div className="steering-buttons">
            <button
              type="button"
              aria-label="왼쪽 조향"
              className={`drive-button steer-left ${on.left ? 'on' : ''}`}
              {...holding('left')}
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="오른쪽 조향"
              className={`drive-button steer-right ${on.right ? 'on' : ''}`}
              {...holding('right')}
            >
              ▶
            </button>
          </div>
        )}
        {mode === 'tilt' && (
          <button type="button" className="tilt-calibrate" onClick={enableTilt}>
            {tiltMessage || '기울기 켜기 · 중앙 맞추기'}
          </button>
        )}
      </div>
      <div className="touch-actions">
        <button
          type="button"
          aria-label="드리프트와 공중 트릭"
          aria-pressed={!!on.drift}
          className={`drive-button drive-drift ${on.drift ? 'on' : ''}`}
          disabled={!racing}
          {...holding('drift')}
        >
          <span className="drive-icon">↪</span>
          <span>{on.drift && toggle ? '놓기 · 터보' : '드리프트'}</span>
          <small>{toggle ? '한 번 눌러 유지' : '누르고 유지 · 공중 트릭'}</small>
        </button>
        <button
          type="button"
          aria-label="아이템 사용"
          className="drive-button drive-item"
          disabled={!racing || (!itemId && !roulette) || sealed}
          {...tapping('item')}
        >
          <span className="drive-icon">{roulette || (itemId && ALL_ITEMS[itemId]?.icon) || '◇'}</span>
          <span>{sealed ? '봉인' : roulette ? '멈추기' : '아이템'}</span>
        </button>
        {raceMode === 'race' && (
          <button
            type="button"
            aria-label="차량 고유기 사용"
            className={`drive-button drive-skill ${gauge >= 100 ? 'ready' : ''}`}
            disabled={!racing || gauge < 100}
            {...tapping('skill')}
          >
            <span className="drive-icon">{skillIcon}</span>
            <span>{gauge >= 100 ? '고유기!' : `${Math.floor(gauge)}%`}</span>
          </button>
        )}
        <button
          type="button"
          aria-label="브레이크와 후진"
          className={`drive-button drive-brake ${on.brake ? 'on' : ''}`}
          {...holding('brake')}
        >
          <span>Ⅱ</span>
          <small>브레이크</small>
        </button>
        <button
          type="button"
          aria-label="뒤 보기"
          className={`drive-button drive-look ${on.lookBack ? 'on' : ''}`}
          {...holding('lookBack')}
        >
          <span>↶</span>
          <small>뒤 보기</small>
        </button>
        {(!autoAccel || countdown) && (
          <button
            type="button"
            aria-label="가속"
            className={`drive-button drive-accel ${on.accel ? 'on' : ''}`}
            {...holding('accel')}
          >
            <span>▲</span>
            <small>{countdown ? '2에서 출발' : '가속'}</small>
          </button>
        )}
        {autoAccel && racing && <span className="auto-accel-note">자동 가속</span>}
      </div>
    </div>
  );
}
