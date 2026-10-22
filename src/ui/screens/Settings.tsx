import { useEffect, useState } from 'react';
import { useSettings, BRAND_MODE, type QualityLevel } from '../../core/settings';
import { TopBar, sfx } from '../common';
import { getShell } from '../../game/shell';
import { useProfile } from '../../net/profileStore';
import { MISSION_BY_ID } from '../../../shared/progress';
import { audio } from '../../audio/engine';
import { say } from '../../audio/voice';
import { Achievements } from './Dashboard';
import { CHAR_BY_ID } from '../../data/characters';
import { portrait } from '../portraits';
import { useApp } from '../../game/app';

export function SettingsBody() {
  const s = useSettings();
  const row = (label: string, el: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #E8EFF8' }}>
      <span style={{ width: 150 }}>{label}</span>
      {el}
    </div>
  );
  const slider = (k: 'bgm' | 'sfx' | 'voice') => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={s[k]}
      onChange={(e) => s.set({ [k]: +e.target.value })}
      onPointerUp={() => (k === 'voice' ? say('momo', 'select', { tts: false }) : audio.play('coin'))}
      style={{ flex: 1 }}
    />
  );
  const opts = <T extends string>(k: keyof typeof s, values: [T, string][]) => (
    <div className="tabs">
      {values.map(([v, l]) => (
        <button
          key={v}
          className={`tab ${s[k] === v ? 'on' : ''}`}
          onClick={() => {
            sfx.click();
            s.set({ [k]: v } as Partial<typeof s>);
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
  const toggle = (k: 'screenShake' | 'autoAccel' | 'restReminder' | 'showFps' | 'rearMirror') => (
    <button className={`tab ${s[k] ? 'on' : ''}`} onClick={() => s.set({ [k]: !s[k] })}>
      {s[k] ? '켜짐' : '꺼짐'}
    </button>
  );
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>⚙️ 설정</h2>
      {row(
        '그래픽 품질',
        opts<QualityLevel>('quality', [
          ['auto', '자동'],
          ['low', '저'],
          ['medium', '중'],
          ['high', '고'],
          ['ultra', '울트라'],
        ]),
      )}
      {row('배경음악', slider('bgm'))}
      {row('효과음', slider('sfx'))}
      {row('캐릭터 보이스', slider('voice'))}
      {row(
        '터치 조향',
        opts<'stick' | 'buttons' | 'tilt'>('touchSteer', [
          ['stick', '가상 스틱'],
          ['buttons', '좌/우 버튼'],
          ['tilt', '기울기'],
        ]),
      )}
      {row('자동 가속(터치)', toggle('autoAccel'))}
      {row('화면 흔들림', toggle('screenShake'))}
      {row('1시간 휴식 알림', toggle('restReminder'))}
      {row('룸미러(후방 화면)', toggle('rearMirror'))}
      {row('FPS 표시', toggle('showFps'))}
      {row(
        '현재 렌더링',
        <span className="chip">
          {(() => {
            try {
              const r = getShell().R;
              return `${{ low: '저', medium: '중', high: '고', ultra: '울트라' }[r.preset]} · 해상도 배율 ×${r.renderScale.toFixed(2)}`;
            } catch {
              return '-';
            }
          })()}
        </span>,
      )}
      {row(
        '전체 화면',
        <button
          className="tab"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())}
        >
          전환
        </button>,
      )}
      {row('BRAND_MODE', <span className="chip">{BRAND_MODE === 'real' ? 'real (실제 로고)' : 'parody (패러디)'}</span>)}
      <div style={{ fontSize: 14, color: '#4B5A78', marginTop: 10, lineHeight: 1.6 }}>
        ⌨️ 조작: 방향키/WASD 이동 · Space 드리프트/공중 360° 트릭 · Shift/E 아이템 · Q 고유기 · C 뒤 보기 · Esc 일시정지 · 🎮 게임패드 지원
      </div>
    </div>
  );
}

export function Settings() {
  useEffect(() => getShell().showroom.setMode('menu'), []);
  return (
    <div className="screen">
      <TopBar title="설정" />
      <div className="panel scroll" style={{ margin: '10px auto', padding: 20, width: 'min(720px, 94vw)', flex: 1 }}>
        <SettingsBody />
      </div>
    </div>
  );
}

export function Missions() {
  const { profile, claimMission } = useProfile();
  const [msg, setMsg] = useState('');
  useEffect(() => getShell().showroom.setMode('menu'), []);
  const card = (m: { id: string; progress: number; claimed: boolean }) => {
    const d = MISSION_BY_ID[m.id];
    if (!d) return null;
    const done = m.progress >= d.goal;
    return (
      <div key={m.id} className="card" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17 }}>{d.text}</div>
          <div style={{ height: 10, background: '#E3ECF7', borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${(m.progress / d.goal) * 100}%`, height: '100%', background: done ? '#7bd389' : 'linear-gradient(90deg,#CFE6FF,#2F6FDB)' }} />
          </div>
          <small>
            {m.progress}/{d.goal} · 🪙{d.reward.toLocaleString()}
          </small>
        </div>
        <button
          className="btn small gold"
          disabled={!done || m.claimed}
          onClick={async () => {
            const e = await claimMission(m.id);
            if (e) setMsg(e);
            else audio.play('buy');
          }}
        >
          {m.claimed ? '받음 ✔' : '받기'}
        </button>
      </div>
    );
  };
  return (
    <div className="screen">
      <TopBar title="미션 · 업적" />
      <div className="panel scroll" style={{ marginTop: 10, padding: 16, flex: 1 }}>
        <h3 style={{ marginTop: 0 }}>📅 일일 미션</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {profile.daily.missions.map(card)}
        </div>
        <h3>🗓️ 주간 미션</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {profile.weekly.missions.map(card)}
        </div>
        {msg && <p style={{ color: '#E8412C' }}>{msg}</p>}
        <div style={{ marginTop: 16 }}>
          <Achievements />
        </div>
      </div>
    </div>
  );
}

export function Profile() {
  const { profile, member, mutate } = useProfile();
  const set = useApp((s) => s.set);
  useEffect(() => getShell().showroom.setMode('menu'), []);
  return (
    <div className="screen">
      <TopBar title="프로필" />
      <div className="panel" style={{ margin: '10px auto', padding: 20, width: 'min(620px, 94vw)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <img src={portrait(profile.selectedChar, profile.equipment[profile.selectedChar] ?? {}, 160)} style={{ width: 110 }} alt="" />
          <div>
            <div style={{ fontSize: 28 }}>{profile.nickname}</div>
            <div>{member ? `@${profile.username}` : '게스트'} · Lv.{profile.level}</div>
            <div>대표 캐릭터: {CHAR_BY_ID[profile.selectedChar].name}</div>
            {profile.title && <div className="chip">🏷️ {profile.title}</div>}
          </div>
        </div>
        <h3>칭호 선택</h3>
        <div className="tabs">
          {profile.titles.length ? (
            profile.titles.map((t) => (
              <button key={t} className={`tab ${profile.title === t ? 'on' : ''}`} onClick={() => mutate((p) => (p.title = t))}>
                {t}
              </button>
            ))
          ) : (
            <span>업적을 달성하면 칭호를 얻어요!</span>
          )}
        </div>
        {!member && (
          <button className="btn mint" style={{ marginTop: 16 }} onClick={() => set({ modal: 'signup' })}>
            회원가입하고 기록 저장하기
          </button>
        )}
      </div>
    </div>
  );
}
