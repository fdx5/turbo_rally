import { useEffect, useRef, useState } from 'react';
import { useHud, minimapRef } from './hudStore';
import { ALL_ITEMS } from '../data/items';
import { portrait } from './portraits';
import type { CharId } from '../data/characters';
import { fmt } from '../race/race';
import { MT_LEVELS } from '../physics/kart';
import { useSettings } from '../core/settings';

const POS_COL = ['#FFB400', '#9AA9C9', '#E0915A', '#FF6FA3', '#FF6FA3', '#A98BE0', '#A98BE0', '#A98BE0'];

export function Hud({ onPause }: { onPause: () => void }) {
  const h = useHud();
  const showFps = useSettings((s) => s.showFps);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [bump, setBump] = useState(false);
  const lastPos = useRef(h.position);
  const lastItem = useRef('');
  const [got, setGot] = useState(false);
  useEffect(() => {
    minimapRef.canvas = mapRef.current;
    return () => {
      minimapRef.canvas = null;
    };
  }, []);
  useEffect(() => {
    if (h.position !== lastPos.current) {
      lastPos.current = h.position;
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      return () => clearTimeout(t);
    }
  }, [h.position]);
  useEffect(() => {
    const cur = h.items[0] ?? '';
    if (cur && cur !== lastItem.current) {
      setGot(true);
      setTimeout(() => setGot(false), 400);
    }
    lastItem.current = cur;
  }, [h.items]);
  const now = performance.now();
  const blind = h.blindUntil > now;
  const flash = h.flashUntil > now;
  const main = h.items[0] ? ALL_ITEMS[h.items[0]] : null;
  const next = h.items[1] ? ALL_ITEMS[h.items[1]] : null;
  const g = h.gauge / 100;
  const C = 2 * Math.PI * 40;
  if (!h.active) return null;
  return (
    <div className="hud">
      <div className={`speedlines ${h.boost ? 'on' : ''}`} />
      {blind && <div className="screen-blind" key={h.blindUntil} />}
      {flash && <div className="screen-flash" key={h.flashUntil} />}
      {h.phase === 'intro' && (
        <div className="intro-card">
          <h2>{h.trackName}</h2>
          <p>{h.mode === 'timeattack' ? '타임어택 · 고스트와 대결!' : h.mode === 'practice' ? '연습 주행' : `${h.laps}랩 · 8인 대전`} — 아무 키나 누르면 시작</p>
        </div>
      )}
      {h.phase !== 'intro' && h.mode === 'race' && (
        <div className={`hud-pos ${bump ? 'bump' : ''}`} style={{ ['--pc' as string]: POS_COL[h.position - 1] }}>
          <span className="n">{h.position}</span>
          <span className="of">/8</span>
        </div>
      )}
      {h.phase !== 'intro' && h.mode === 'race' && (
        <div className="hud-stand">
          {h.standings.map((s) => (
            <div key={s.slot} className={`row ${s.isPlayer ? 'me' : ''}`}>
              <span className="num" style={{ width: 14 }}>
                {s.position}
              </span>
              <img src={portrait(s.charId as CharId, {}, 64)} alt="" />
              <span>{s.name}</span>
              {s.finished && <span>🏁</span>}
            </div>
          ))}
        </div>
      )}
      <div className="hud-top">
        <div className="hud-lap">
          LAP <b className="num">{h.lap}</b>/{h.laps}
        </div>
        <div className="hud-time">{fmt(h.timeMs)}</div>
      </div>
      {h.lapFlash && <div className="lapflash">랩 {h.lapFlash}</div>}
      {h.mode !== 'timeattack' || h.items.length ? (
        <div className="hud-items">
          <div className={`slot small`}>{next ? <span>{next.icon}</span> : null}</div>
          <div className={`slot ${h.rouletteIcon ? 'spin' : ''} ${got ? 'got' : ''}`}>
            {h.rouletteIcon ? <span>{h.rouletteIcon}</span> : main ? <span>{main.icon}</span> : null}
            {main && !h.rouletteIcon && <div className="name">{main.name}</div>}
          </div>
        </div>
      ) : null}
      <div className="status-icons">
        {h.reversed && <span title="조향 반전">↔️</span>}
        {h.sealed && <span title="아이템 봉인">🔒</span>}
      </div>
      {h.mode === 'race' && (
        <div className={`hud-skill ${h.skillReady ? 'ready' : ''}`}>
          <svg viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="9" />
            <circle cx="46" cy="46" r="40" fill="none" stroke={h.skillReady ? '#FFCF4A' : '#FF8FB8'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * g} ${C}`} transform="rotate(-90 46 46)" />
          </svg>
          <div className="ic">{h.skillIcon}</div>
          <div className="key">Q</div>
        </div>
      )}
      <div className="hud-coins">
        <span>⭐</span> {h.coins}
        <small style={{ fontSize: 14 }}>/{h.maxCoins}</small>
      </div>
      <div className="hud-speed">
        {h.kmh}
        <small> km/h</small>
      </div>
      {h.mtLevel > 0 && (
        <div className="mt-indicator">
          {MT_LEVELS.map((l, i) => (
            <i key={i} className={i < h.mtLevel ? 'on' : ''} style={i < h.mtLevel ? { background: l.color, color: l.color } : undefined} />
          ))}
        </div>
      )}
      <canvas ref={mapRef} className="hud-map" width={220} height={220} />
      {h.countdown && (
        <div key={h.countdown} className={`center-msg countdown ${h.countdown === 'GO!' ? 'go' : ''}`}>
          {h.countdown}
        </div>
      )}
      {h.finalLap && <div className="center-msg banner">마지막 랩!</div>}
      {h.phase === 'finish' && <div className="center-msg countdown go" style={{ animationDuration: '3s' }}>FINISH!</div>}
      {h.wrongWay && <div className="wrongway">거꾸로 가고 있어요! 🔄</div>}
      <div className="toast">
        {h.toasts.map((t) => (
          <div key={t.id} style={t.color ? { color: t.color } : undefined}>
            {t.text}
          </div>
        ))}
      </div>
      <button className="btn icon ghost tap pausebtn" onClick={onPause} aria-label="일시정지">
        ⏸
      </button>
      {showFps && (
        <div style={{ position: 'absolute', left: '50%', bottom: 56, transform: 'translateX(-50%)', fontSize: 12, background: '#fff9', borderRadius: 8, padding: '2px 8px' }} className="num">
          {h.fps} fps · {h.draws} draws · {(h.tris / 1000).toFixed(0)}k tris
        </div>
      )}
    </div>
  );
}
