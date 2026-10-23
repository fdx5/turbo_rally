import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { getShell } from '../../game/shell';
import { TopBar, Stars, sfx, trackImage, fmtMs } from '../common';
import { TRACKS } from '../../data/tracks';
import { countStars, DIFF_MUL, medalFor, vehiclePrice } from '../../../shared/economy';
import { CHARACTERS, CHAR_BY_ID, type CharId } from '../../data/characters';
import { STAT_KEYS, STAT_LABEL, VEHICLES, VEHICLE_BY_ID, type StatKey } from '../../data/vehicles';
import { finalStats, displayTopKmh } from '../../data/statCurves';
import { say } from '../../audio/voice';
import { audio } from '../../audio/engine';
import { vehicleThumb, portrait } from '../portraits';
import { DIFF, type Difficulty } from '../../ai/driver';
import { startRaceFlow } from '../raceFlow';
import { I } from '../icons';

export function ModeSelect() {
  const { set, go, difficulty } = useApp();
  useEffect(() => getShell().showroom.setMode('menu'), []);
  const cards: { d: Difficulty; icon: string; desc: string }[] = [
    { d: 'easy', icon: '🌱', desc: 'AI가 느긋해요. 처음이라면 여기서!' },
    { d: 'normal', icon: '🔥', desc: '적당한 승부! 골드 ×1.25' },
    { d: 'hard', icon: '👑', desc: 'AI가 드리프트·지름길 장인! 골드 ×1.5, ★3 획득 가능' },
  ];
  return (
    <div className="screen mode-select">
      <TopBar title="난이도 선택" />
      <div
        className="difficulty-options"
        style={{
          flex: 1,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {cards.map((c) => (
          <div
            key={c.d}
            className={`card ${difficulty === c.d ? 'sel' : ''}`}
            style={{ width: 230, textAlign: 'center', padding: 20 }}
            onClick={() => {
              sfx.click();
              set({ difficulty: c.d });
              go('track');
            }}
          >
            <div style={{ fontSize: 54 }}>{c.icon}</div>
            <div style={{ fontSize: 28 }}>{DIFF[c.d].label}</div>
            <div className="chip" style={{ margin: '8px 0' }}>
              골드 ×{DIFF_MUL[c.d]}
            </div>
            <div style={{ fontSize: 15, color: '#4B5A78' }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackSelect() {
  const { mode, set, go, trackId } = useApp();
  const { profile, member } = useProfile();
  useEffect(() => getShell().showroom.setMode('track'), []);
  return (
    <div className="screen">
      <TopBar
        title={
          mode === 'timeattack'
            ? '트랙 선택 · 타임어택'
            : mode === 'practice'
              ? '트랙 선택 · 연습'
              : '트랙 선택'
        }
      />
      <div style={{ color: '#365575', marginTop: 8, fontSize: 14 }}>
        {TRACKS.length}개의 탐험 코스 · 각기 다른 풍경과 여러 갈래의 입체 도로
      </div>
      <div className="scroll" style={{ flex: 1, marginTop: 12 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {TRACKS.map((t) => {
            const open = profile.unlockedTracks.includes(t.id);
            const memberLock = !member && t.no >= 4 && open;
            const locked = !open || memberLock;
            const st = countStars(profile.stars[t.id] ?? 0);
            const ta = profile.bestTA[t.id];
            const medal = ta ? medalFor(t.id, ta.ms) : null;
            return (
              <div
                key={t.id}
                className={`card ${trackId === t.id ? 'sel' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => {
                  if (locked) {
                    sfx.error();
                    return;
                  }
                  sfx.click();
                  set({ trackId: t.id });
                  go('character');
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={trackImage(t)}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      display: 'block',
                      filter: locked ? 'brightness(0.55) saturate(0.4)' : undefined,
                    }}
                    alt=""
                  />
                  {locked && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: 15,
                        textShadow: '0 2px 4px #1E2B4A',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 40 }}>🔒</div>
                        {memberLock ? '회원 전용' : `트랙 ${t.no - 1}에서 3등 이내 입상 시 오픈!`}
                      </div>
                    </div>
                  )}
                  <div
                    className="chip"
                    style={{ position: 'absolute', left: 8, top: 8, padding: '2px 10px' }}
                  >
                    {t.no}
                  </div>
                </div>
                <div style={{ fontSize: 20, marginTop: 8 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#24618A', margin: '5px 0', fontWeight: 700 }}>
                  {Math.round(Math.min(...t.points.map((p) => p[1])))}–
                  {Math.round(Math.max(...t.points.map((p) => p[1])))}m · {t.shortcuts.length + 1}개 경로 ·
                  급커브 · 급경사 · 점프
                </div>
                <div style={{ fontSize: 13, color: '#4B5A78', minHeight: 34 }}>{t.desc}</div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <Stars n={st} />
                  <span style={{ fontSize: 13 }}>
                    {mode === 'timeattack'
                      ? `${medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : ''} ${ta ? fmtMs(ta.ms) : '기록 없음'}`
                      : profile.bestRace[t.id]
                        ? `최고 ${profile.bestRace[t.id].pos}위`
                        : ''}
                  </span>
                </div>
                {mode === 'timeattack' && (
                  <div style={{ fontSize: 12, color: '#2F6FDB' }}>
                    🥇{fmtMs(t.medals.gold)} 🥈{fmtMs(t.medals.silver)} 🥉{fmtMs(t.medals.bronze)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CharacterSelect() {
  const { go } = useApp();
  const { profile, select } = useProfile();
  const [sel, setSel] = useState<CharId>(profile.selectedChar);
  useEffect(() => {
    const sr = getShell().showroom;
    sr.setMode('characters');
    sr.lineupLoadouts(profile.equipment as Record<CharId, object>);
    sr.selectedChar = sel;
  }, []);
  const pick = (id: CharId) => {
    setSel(id);
    getShell().showroom.pickCharacter(id);
    audio.play('uiClick');
    say(id, 'select', { tts: true });
  };
  const c = CHAR_BY_ID[sel];
  return (
    <div className="screen character-select">
      <TopBar title="캐릭터 선택" />
      <div className="spacer" />
      <div
        className="panel character-info"
        style={{ alignSelf: 'center', padding: '10px 18px', textAlign: 'center', marginBottom: 10 }}
      >
        <div style={{ fontSize: 30 }}>
          {c.name} <small style={{ fontSize: 16, color: '#2F6FDB' }}>{c.motif}</small>
        </div>
        <div style={{ fontSize: 16 }}>
          체급 <b>{c.weightClass}</b> ·{' '}
          {Object.entries(c.mods)
            .map(([k, v]) => `${STAT_LABEL[k as StatKey]} ${v! > 0 ? '+' : ''}${v}`)
            .join(', ') || '보정 없음'}
        </div>
        <div style={{ fontSize: 16, color: '#FF5A36' }}>✨ {c.passive.text}</div>
        <div style={{ fontSize: 15, color: '#4B5A78' }}>"{c.lines.select}"</div>
      </div>
      <div className="character-footer" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <div className="character-options" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {CHARACTERS.map((ch) => (
          <div
            key={ch.id}
            className={`card ${sel === ch.id ? 'sel' : ''}`}
            style={{ padding: 6, width: 86, textAlign: 'center' }}
            onClick={() => pick(ch.id)}
          >
            <img
              src={portrait(ch.id, profile.equipment[ch.id] ?? {}, 120)}
              style={{ width: 70, height: 70 }}
              alt=""
            />
            <div style={{ fontSize: 15 }}>{ch.name}</div>
          </div>
        ))}
        </div>
        <button
          className="btn big"
          onClick={() => {
            sfx.click();
            select(sel, profile.selectedVehicle);
            go('vehicle');
          }}
        >
          다음 <I name="play" size={22} />
        </button>
      </div>
    </div>
  );
}

function Radar({ stats, base }: { stats: Record<StatKey, number>; base: Record<StatKey, number> }) {
  const pt = (i: number, v: number) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return `${Math.cos(a) * v * 7},${Math.sin(a) * v * 7}`;
  };
  return (
    <svg viewBox="-90 -90 180 180" style={{ width: 170, height: 170 }}>
      {[2, 4, 6, 8, 10].map((r) => (
        <polygon key={r} points={STAT_KEYS.map((_, i) => pt(i, r)).join(' ')} fill="none" stroke="#D5E2F2" />
      ))}
      <polygon
        points={STAT_KEYS.map((k, i) => pt(i, base[k])).join(' ')}
        fill="rgba(162,210,255,0.35)"
        stroke="#a2d2ff"
        strokeWidth="2"
      />
      <polygon
        points={STAT_KEYS.map((k, i) => pt(i, stats[k])).join(' ')}
        fill="rgba(255,143,184,0.45)"
        stroke="#FF6B3D"
        strokeWidth="3"
        style={{ transition: 'all .4s' }}
      />
      {STAT_KEYS.map((k, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return (
          <text
            key={k}
            x={Math.cos(a) * 82}
            y={Math.sin(a) * 82}
            fontSize="11"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#4B5A78"
          >
            {STAT_LABEL[k]}
          </text>
        );
      })}
    </svg>
  );
}

export function VehicleSelect() {
  const { trackId, mode, difficulty } = useApp();
  const { profile, select, member, buy } = useProfile();
  const [sel, setSel] = useState(profile.selectedVehicle);
  const [msg, setMsg] = useState('');
  const owned = (id: string) => profile.unlockedVehicles.includes(id);
  useEffect(() => {
    const sr = getShell().showroom;
    sr.setMode('vehicle');
  }, []);
  useEffect(() => {
    getShell().showroom.setKart(sel, profile.selectedChar, profile.equipment[profile.selectedChar] ?? {});
  }, [sel, profile.selectedChar, profile.equipment]);
  const v = VEHICLE_BY_ID[sel];
  const st = finalStats(sel, profile.selectedChar);
  const sum = useMemo(() => STAT_KEYS.reduce((a, k) => a + v.stats[k], 0), [v]);
  const unlockText = (id: string) => {
    const u = VEHICLE_BY_ID[id].unlock;
    if (u.kind === 'level') return `레벨 ${u.level} 달성 시 해금`;
    if (u.kind === 'stars') return `별 ${u.stars}개 모으면 해금`;
    if (u.kind === 'gold') return `${u.price.toLocaleString()}G로 구매`;
    return '';
  };
  return (
    <div className="screen vehicle-select">
      <TopBar title="차량 선택" />
      <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0, marginTop: 10 }}>
        <div className="scroll panel" style={{ width: 'min(330px, 34vw)', padding: 10 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {VEHICLES.map((vd) => (
              <div
                key={vd.id}
                className={`card ${sel === vd.id ? 'sel' : ''} ${owned(vd.id) ? '' : 'locked'}`}
                style={{ padding: 4, textAlign: 'center' }}
                onClick={() => {
                  sfx.click();
                  setSel(vd.id);
                  setMsg('');
                }}
              >
                <img src={vehicleThumb(vd.id, profile.selectedChar, 160)} style={{ width: '100%' }} alt="" />
                <div style={{ fontSize: 12, lineHeight: 1.1 }}>{vd.name}</div>
                {!owned(vd.id) && <div style={{ position: 'absolute', right: 6, top: 4 }}>🔒</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="spacer" />
        <div
          className="panel vehicle-summary"
          style={{
            width: 'min(380px, 40vw)',
            padding: 16,
            alignSelf: 'flex-start',
            maxHeight: '100%',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 24 }}>
            {String(v.no).padStart(2, '0')}. {v.name}
          </div>
          <div style={{ fontSize: 14, color: '#4B5A78' }}>{v.desc}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radar stats={st} base={v.stats} />
            <div style={{ flex: 1 }}>
              {STAT_KEYS.map((k) => {
                const d = st[k] - v.stats[k];
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ width: 52 }}>{STAT_LABEL[k]}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 10,
                        background: '#E8EFF8',
                        borderRadius: 6,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: `${st[k] * 10}%`,
                          height: '100%',
                          background: d > 0 ? '#7bd389' : d < 0 ? '#ff8fa3' : '#BFDDFF',
                          transition: 'width .4s, background .4s',
                        }}
                      />
                    </div>
                    <b
                      className="num"
                      style={{ width: 34, color: d > 0 ? '#3cb36a' : d < 0 ? '#E8412C' : undefined }}
                    >
                      {st[k]}
                      {d ? <small>{d > 0 ? `+${d}` : d}</small> : null}
                    </b>
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: '#2F6FDB' }}>
                기본 총합 {sum} · 최고 {displayTopKmh(st.speed)}km/h
              </div>
            </div>
          </div>
          <div className="card" style={{ cursor: 'default', marginTop: 6 }}>
            <b>⚡ 고유기: {v.skill.name}</b>
            <div style={{ fontSize: 14 }}>{v.skill.desc}</div>
          </div>
          {msg && <div style={{ color: '#E8412C', marginTop: 6 }}>{msg}</div>}
          <div className="vehicle-start" style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
            {owned(sel) ? (
              <button
                className="btn big"
                onClick={async () => {
                  sfx.click();
                  select(profile.selectedChar, sel);
                  await startRaceFlow(trackId, mode, difficulty);
                }}
              >
                <I name="flag" size={30} /> 출발!
              </button>
            ) : v.unlock.kind === 'gold' ? (
              <button
                className="btn gold"
                onClick={async () => {
                  if (!member) {
                    setMsg('차량 구매는 회원 전용이에요 🛍️');
                    return;
                  }
                  const e = await buy('veh:' + sel);
                  if (e) setMsg(e);
                  else audio.play('unlock');
                }}
              >
                🪙 {vehiclePrice(sel)?.toLocaleString()} 구매
              </button>
            ) : (
              <div className="chip">🔒 {unlockText(sel)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
