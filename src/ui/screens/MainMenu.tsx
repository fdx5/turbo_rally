import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { getShell } from '../../game/shell';
import { Modal, sfx, useCountUp } from '../common';
import { Logo } from '../Logo';
import { I, type IconName } from '../icons';
import { COSMETICS, COSMETIC_BY_ID } from '../../data/cosmetics';
import { ATTENDANCE_REWARDS, ROULETTE } from '../../../shared/progress';
import { audio } from '../../audio/engine';
import { music } from '../../audio/music';
import { CHAR_BY_ID } from '../../data/characters';
import { VEHICLE_BY_ID } from '../../data/vehicles';
import { TRACKS } from '../../data/tracks';
import { countStars, xpToNext } from '../../../shared/economy';
import { InstallButton, FullscreenButton } from '../MobileDisplay';

export function MainMenu() {
  const { go, set } = useApp();
  const { profile, member, logout } = useProfile();
  useEffect(() => {
    const sh = getShell();
    sh.showroom.setMode('menu');
    sh.showroom.setKart(profile.selectedVehicle, profile.selectedChar, profile.equipment[profile.selectedChar] ?? {});
    music.play('menu');
  }, [profile.selectedVehicle, profile.selectedChar, profile.equipment]);
  // nearest affordable goal (§17-10)
  const next = useMemo(() => {
    const cands = COSMETICS.filter((c) => !profile.inventory.includes(c.id) && c.price > profile.gold).sort((a, b) => a.price - b.price);
    return cands[0];
  }, [profile.gold, profile.inventory]);
  const nextTrack = TRACKS.find((t) => !profile.unlockedTracks.includes(t.id));
  const prevTrack = nextTrack ? TRACKS[nextTrack.no - 2] : null;
  const stars = Object.values(profile.stars).reduce((a, b) => a + countStars(b), 0);
  const openMissions = [...profile.daily.missions, ...profile.weekly.missions].filter((m) => !m.claimed).length;
  const gold = useCountUp(profile.gold, 700);
  const pick = (mode: 'race' | 'timeattack' | 'practice') => {
    sfx.click();
    set({ mode });
    go(mode === 'race' ? 'mode' : 'track');
  };
  return (
    <div className="screen main-menu">
      <div className="topbar" style={{ alignItems: 'flex-start' }}>
        <Logo width={250} />
        <div className="spacer" />
        <div className="tag" title={`${profile.xp} XP`}>
          <span className="chip" style={{ padding: '1px 8px', boxShadow: 'none', background: '#2F6FDB', color: '#fff', fontFamily: 'var(--head)' }}>
            Lv.{profile.level}
          </span>
          <div className="meter" style={{ width: 80, height: 10 }}>
            <i style={{ width: `${(profile.xp / xpToNext(profile.level)) * 100}%` }} />
          </div>
        </div>
        <div className="tag">
          <I name="star" size={26} /> {stars}
          <small style={{ fontSize: 13, opacity: 0.6 }}>/24</small>
        </div>
        <div className="tag">
          <I name="coin" size={26} /> {gold.toLocaleString()}
        </div>
        <button
          className="btn lav"
          onClick={() => {
            sfx.click();
            go('dashboard');
          }}
        >
          <I name="chart" size={24} /> 대시보드
        </button>
      </div>
      <div className="menu-mode-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, paddingLeft: 10 }}>
        <div className="mode-tile" onClick={() => pick('race')}>
          <div className="badge">
            <I name="flag" size={40} />
          </div>
          <div>
            <div className="t">대전 레이스</div>
            <div className="s">8명이 함께 달리는 아이템 배틀 · 3랩</div>
          </div>
        </div>
        <div className="mode-tile" style={{ ['--c' as string]: '#3f9cff', marginLeft: 22 }} onClick={() => pick('timeattack')}>
          <div className="badge">
            <I name="timer" size={40} />
          </div>
          <div>
            <div className="t">타임어택</div>
            <div className="s">고스트와 겨루는 기록 도전 · 메달 획득</div>
          </div>
        </div>
        <div className="mode-tile" style={{ ['--c' as string]: '#3fc46e', marginLeft: 44, width: 'min(360px, 38vw)' }} onClick={() => pick('practice')}>
          <div className="badge">
            <I name="car" size={40} />
          </div>
          <div>
            <div className="t">연습 주행</div>
            <div className="s">부담 없이 코스 익히기</div>
          </div>
        </div>
        <div className="menu-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {(
            [
              ['bag', '상점', () => go('shop'), 0],
              ['target', '미션', () => go('missions'), openMissions],
              ['calendar', '출석', () => set({ modal: 'attendance' }), profile.attendance.claimedToday ? 0 : '!'],
              ['wheel', '룰렛', () => set({ modal: 'roulette' }), profile.daily.roulette ? 0 : '!'],
              ['gear', '설정', () => go('settings'), 0],
              ['user', '프로필', () => go('profile'), 0],
            ] as [IconName, string, () => void, number | string][]
          ).map(([icon, label, fn, badge]) => (
            <div
              key={label}
              className="mini-tile"
              onClick={() => {
                sfx.click();
                fn();
              }}
            >
              <I name={icon} size={38} />
              {label}
              {badge ? <span className="dot">{badge}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="menu-footer" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="license" style={{ width: 'min(430px, 46vw)' }}>
          <h4>
            {member ? profile.nickname : '게스트 레이서'} · {CHAR_BY_ID[profile.selectedChar].name} & {VEHICLE_BY_ID[profile.selectedVehicle]?.name}
          </h4>
          {next && (
            <>
              <div>
                다음 목표 <b>{next.name}</b> — {(next.price - profile.gold).toLocaleString()}골드 남음
              </div>
              <div className="meter" style={{ margin: '4px 0 6px' }}>
                <i style={{ width: `${Math.min(100, (profile.gold / next.price) * 100)}%` }} />
              </div>
            </>
          )}
          {nextTrack && prevTrack && (
            <div>
              <I name="lock" size={16} /> 트랙 {nextTrack.no} 「{nextTrack.name}」 — 트랙 {prevTrack.no}에서 3등 이내 한 번이면 열려요
            </div>
          )}
        </div>
        <div className="spacer" />
        <div className="mobile-display-actions"><InstallButton /><FullscreenButton /></div>
        {member ? (
          <button className="btn ghost small" onClick={() => logout()}>
            로그아웃
          </button>
        ) : (
          <button className="btn mint" onClick={() => set({ modal: 'signup' })}>
            회원가입하고 기록 저장
          </button>
        )}
      </div>
    </div>
  );
}

export function AttendanceModal() {
  const set = useApp((s) => s.set);
  const { profile, claimAttendance } = useProfile();
  const [msg, setMsg] = useState('');
  const streakDay = profile.attendance.claimedToday ? ((profile.attendance.streak - 1) % 7) + 1 : (profile.attendance.streak % 7) + 1;
  return (
    <Modal onClose={() => set({ modal: null })} wide>
      <h2 style={{ marginTop: 0 }}>📅 출석 보상 — 연속 {profile.attendance.streak}일째</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {ATTENDANCE_REWARDS.map((r, i) => {
          const day = i + 1;
          const done = day < streakDay || (day === streakDay && profile.attendance.claimedToday);
          const todayCell = day === streakDay && !profile.attendance.claimedToday;
          return (
            <div key={i} className="card" style={{ textAlign: 'center', padding: 8, borderColor: todayCell ? '#FF6B3D' : 'transparent', opacity: done ? 0.6 : 1 }}>
              <div>{day}일</div>
              <div style={{ fontSize: 28 }}>{r === -1 ? '🎁' : '🪙'}</div>
              <small>{r === -1 ? '레어 상자' : `${r}G`}</small>
              {done && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 34 }}>✅</div>}
            </div>
          );
        })}
      </div>
      <p style={{ color: '#2F6FDB' }}>하루라도 빠지면 1일차부터 다시 시작해요!</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn gold"
          disabled={profile.attendance.claimedToday}
          onClick={async () => {
            const r = await claimAttendance();
            if (typeof r === 'string') setMsg(r);
            else {
              audio.play('buy');
              setMsg(r.item ? `🎁 ${COSMETIC_BY_ID[r.item]?.name} 획득!` : `🪙 ${r.gold.toLocaleString()}G 획득!`);
            }
          }}
        >
          {profile.attendance.claimedToday ? '오늘 출석 완료' : '출석하기!'}
        </button>
        <span>{msg}</span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => set({ modal: null })}>
          닫기
        </button>
      </div>
    </Modal>
  );
}

export function RouletteModal() {
  const set = useApp((s) => s.set);
  const { profile, spin } = useProfile();
  const [angle, setAngle] = useState(0);
  const [msg, setMsg] = useState('');
  const [spinning, setSpinning] = useState(false);
  const n = ROULETTE.length;
  const cols = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#C9D8EE', '#CFE6FF'];
  return (
    <Modal onClose={() => !spinning && set({ modal: null })}>
      <h2 style={{ marginTop: 0, textAlign: 'center' }}>🎡 무료 럭키 룰렛 (1일 1회)</h2>
      <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto' }}>
        <svg viewBox="-100 -100 200 200" style={{ width: '100%', height: '100%', transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 3.2s cubic-bezier(0.15, 0.9, 0.2, 1)' : 'none' }}>
          {ROULETTE.map((seg, i) => {
            const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
            const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
            const am = (a0 + a1) / 2;
            return (
              <g key={i}>
                <path d={`M0 0 L${Math.cos(a0) * 95} ${Math.sin(a0) * 95} A95 95 0 0 1 ${Math.cos(a1) * 95} ${Math.sin(a1) * 95} Z`} fill={cols[i % cols.length]} stroke="#fff" strokeWidth="3" />
                <text x={Math.cos(am) * 60} y={Math.sin(am) * 60} fontSize="11" textAnchor="middle" dominantBaseline="middle" fill="#1E2B4A" transform={`rotate(${(am * 180) / Math.PI + 90} ${Math.cos(am) * 60} ${Math.sin(am) * 60})`}>
                  {seg.label}
                </text>
              </g>
            );
          })}
          <circle r="14" fill="#fff" stroke="#FF6B3D" strokeWidth="4" />
        </svg>
        <div style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', fontSize: 30 }}>🔻</div>
      </div>
      <details style={{ fontSize: 14, margin: '8px 0' }}>
        <summary>확률 공개</summary>
        {ROULETTE.map((s, i) => (
          <div key={i}>
            {s.label}: {(s.p * 100).toFixed(0)}%
          </div>
        ))}
        <div>※ 현금 결제 없음 · 골드/아이템만 지급돼요</div>
      </details>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn gold"
          disabled={profile.daily.roulette || spinning}
          onClick={async () => {
            const r = await spin();
            if (typeof r === 'string') return setMsg(r);
            setSpinning(true);
            audio.play('roulette');
            const target = 360 * 5 + (360 - ((r.index + 0.5) / n) * 360);
            setAngle(target);
            setTimeout(() => {
              setSpinning(false);
              audio.play('buy');
              setMsg(r.item ? `🎁 ${COSMETIC_BY_ID[r.item]?.name} 획득!` : `🪙 ${r.gold.toLocaleString()}G 획득!`);
            }, 3300);
          }}
        >
          {profile.daily.roulette && !spinning ? '내일 다시!' : '돌리기!'}
        </button>
        <span>{msg}</span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => !spinning && set({ modal: null })}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
