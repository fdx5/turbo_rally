import { useEffect, useState } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { fmtMs, GoldChip, sfx, useCountUp } from '../common';
import { portrait } from '../portraits';
import { CHAR_BY_ID, type CharId } from '../../data/characters';
import { VEHICLE_BY_ID } from '../../data/vehicles';
import { TRACK_BY_ID, TRACKS } from '../../data/tracks';
import { audio } from '../../audio/engine';
import { startRaceFlow } from '../raceFlow';
import { music } from '../../audio/music';
import { ACH_BY_ID } from '../../../shared/progress';
import { DIFF } from '../../ai/driver';
import { I } from '../icons';

export function Results() {
  const { lastResult, trackId, mode, difficulty, go, set } = useApp();
  const { profile, member, server } = useProfile();
  const [shown, setShown] = useState(0);
  const res = lastResult?.result;
  const out = lastResult?.out;
  const lines = out?.reward.lines ?? [];
  useEffect(() => {
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(i);
      if (i <= lines.length) audio.play('goldTick', { rate: 1 + i * 0.06 });
      if (i === lines.length + 1) {
        if (out?.newTracks.length || out?.newVehicles.length) audio.play('unlock');
        if (out?.levelUps.length) setTimeout(() => audio.play('levelUp'), 400);
      }
      if (i > lines.length + 1) clearInterval(id);
    }, 380);
    // guest nudges (§11.2)
    if (!member && server) {
      if (profile.guestRaces === 3) setTimeout(() => set({ modal: 'promo' }), 2600);
    }
    return () => clearInterval(id);
  }, [lastResult]);
  const sumShown = lines.slice(0, shown).reduce((a, b) => a + b.gold, 0);
  const goldShown = useCountUp(sumShown, 300);
  if (!res) return null;
  const t = TRACK_BY_ID[res.trackId];
  const nextLocked = TRACKS.find((x) => !profile.unlockedTracks.includes(x.id));
  const sorted = [...res.entrants].sort((a, b) => a.position - b.position);
  const again = () => {
    sfx.click();
    startRaceFlow(trackId, mode, difficulty);
  };
  return (
    <div className="screen results-screen">
      <div className="topbar">
        <h1>
          {mode === 'race' ? `${res.position}위!` : mode === 'timeattack' ? `기록 ${fmtMs(res.totalMs)}` : '연습 완료'} {res.position === 1 && mode === 'race' ? '🏆' : ''}
        </h1>
        <span className="chip">
          {t.name} · {mode === 'race' ? DIFF[difficulty].label : mode === 'timeattack' ? '타임어택' : '연습'}
        </span>
        <div className="spacer" />
        <GoldChip big />
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0, marginTop: 10 }}>
        <div className="panel scroll" style={{ width: 'min(400px, 42vw)', padding: 12 }}>
          {sorted.map((e) => (
            <div key={e.slot} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 12, background: e.isPlayer ? '#EEF6FF' : undefined, fontSize: 16 }}>
              <b className="num" style={{ width: 22, fontSize: 20, color: e.position === 1 ? '#f0a400' : e.position === 2 ? '#8a98b8' : e.position === 3 ? '#d0784a' : '#2F6FDB' }}>
                {e.position}
              </b>
              <img src={portrait(e.charId as CharId, {}, 64)} style={{ width: 34, height: 34 }} alt="" />
              <div style={{ flex: 1, lineHeight: 1.1 }}>
                {e.isPlayer ? profile.nickname || CHAR_BY_ID[e.charId as CharId].name : CHAR_BY_ID[e.charId as CharId].name}
                <div style={{ fontSize: 11, color: '#2F6FDB' }}>{VEHICLE_BY_ID[e.vehicleId]?.name}</div>
              </div>
              <span className="num" style={{ fontSize: 14 }}>
                {fmtMs(e.totalMs)}
              </span>
            </div>
          ))}
          {res.lapTimes.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              랩 타임: {res.lapTimes.map((l, i) => <span key={i} className="chip" style={{ fontSize: 13, padding: '2px 8px', margin: 2 }}>{i + 1}랩 {fmtMs(l)}</span>)}
            </div>
          )}
        </div>
        <div className="spacer" />
        <div className="panel" style={{ width: 'min(400px, 44vw)', padding: 14, alignSelf: 'flex-start' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>💰 보상</div>
          {!out && <div style={{ color: '#E8412C' }}>기록 검증에 실패해 보상이 지급되지 않았어요.</div>}
          {lines.slice(0, shown).map((l) => (
            <div key={l.key} className="pop-in" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17 }}>
              <span>{l.label}</span>
              <b className="num" style={{ color: '#f0a400' }}>+{l.gold.toLocaleString()}</b>
            </div>
          ))}
          <div style={{ borderTop: '2px dashed #D5E2F2', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 22 }}>
            <span>합계</span>
            <b className="num" style={{ color: '#f0a400' }}>🪙 {goldShown.toLocaleString()}</b>
          </div>
          {shown > lines.length && out && (
            <div className="pop-in" style={{ marginTop: 8, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>✨ 경험치 +{out.xpGain}</div>
              {out.levelUps.map((l) => (
                <div key={l} style={{ color: '#2F6FDB' }}>🎉 레벨 {l} 달성!</div>
              ))}
              {out.starsAfter > out.starsBefore && <div>⭐ 별 +{out.starsAfter - out.starsBefore} (총 {out.starsAfter}개)</div>}
              {out.newTracks.map((id) => (
                <div key={id} style={{ color: '#FF5A36', fontSize: 18 }}>
                  🔓 짜잔! 트랙 「{TRACK_BY_ID[id].name}」 오픈!
                </div>
              ))}
              {out.newVehicles.map((id) => (
                <div key={id} style={{ color: '#3cb36a' }}>🚗 새 차량 「{VEHICLE_BY_ID[id].name}」 해금!</div>
              ))}
              {out.achievements.map((id) => (
                <div key={id}>🏅 업적 달성: {ACH_BY_ID[id]?.name}</div>
              ))}
              {out.medal && <div>🏅 {out.medal === 'gold' ? '금' : out.medal === 'silver' ? '은' : '동'}메달!</div>}
              {profile.winStreak >= 2 && mode === 'race' && <div style={{ color: '#ff6b3d' }}>🔥 {profile.winStreak}연승 중!</div>}
            </div>
          )}
          {nextLocked && nextLocked.no >= 2 && (
            <div style={{ marginTop: 8, fontSize: 14, color: '#4B5A78' }}>
              🎯 트랙 {nextLocked.no}까지: 트랙 {nextLocked.no - 1}에서 3등 1번 남았어요!
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
        {!member && server && profile.guestRaces < 3 && <div className="chip">회원가입하면 기록이 영원히 저장돼요 💾</div>}
        <div className="spacer" />
        <button
          className="btn ghost"
          onClick={() => {
            sfx.click();
            go('dashboard');
          }}
        >
          <I name="chart" size={22} /> 기록 보기
        </button>
        <button
          className="btn sky"
          onClick={() => {
            sfx.back();
            music.play('menu');
            set({ screen: 'menu', prev: [] });
          }}
        >
          <I name="home" size={22} /> 메뉴
        </button>
        <button className="btn big" onClick={again} style={{ fontSize: 34, padding: '18px 50px' }}>
          <I name="retry" size={30} /> 한 판 더!
        </button>
      </div>
    </div>
  );
}
