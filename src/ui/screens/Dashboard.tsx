import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../../net/profileStore';
import { getShell } from '../../game/shell';
import { TopBar, fmtMs, Stars, trackImage } from '../common';
import { TRACKS, TRACK_BY_ID } from '../../data/tracks';
import { CHAR_BY_ID, CHARACTERS, type CharId } from '../../data/characters';
import { VEHICLE_BY_ID } from '../../data/vehicles';
import { ALL_ITEMS } from '../../data/items';
import { countStars, medalFor } from '../../../shared/economy';
import { ACHIEVEMENTS, MISSION_BY_ID, type RaceRecord } from '../../../shared/progress';
import { music } from '../../audio/music';
import { api } from '../../net/api';
import { portrait } from '../portraits';
import { startRaceFlow, unb64 } from '../raceFlow';
import { useApp } from '../../game/app';
import { DIFF } from '../../ai/driver';

type Tab = 'overview' | 'races' | 'tracks' | 'ranking' | 'combos' | 'items' | 'ledger' | 'ach';
const TABS: [Tab, string][] = [
  ['overview', '개요'],
  ['races', '레이스 기록'],
  ['tracks', '트랙별 기록'],
  ['ranking', '랭킹'],
  ['combos', '캐릭터·차량'],
  ['items', '아이템·무기'],
  ['ledger', '골드 내역'],
  ['ach', '업적·미션'],
];

function LineChart({ values, max = 8 }: { values: number[]; max?: number }) {
  const W = 360;
  const H = 140;
  const pts = values.map((v, i) => [20 + (i / Math.max(1, values.length - 1)) * (W - 40), 15 + ((v - 1) / (max - 1)) * (H - 30)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 420 }}>
      {[1, 4, 8].map((r) => (
        <g key={r}>
          <line x1="16" x2={W - 10} y1={15 + ((r - 1) / (max - 1)) * (H - 30)} y2={15 + ((r - 1) / (max - 1)) * (H - 30)} stroke="#f0e4f7" />
          <text x="2" y={19 + ((r - 1) / (max - 1)) * (H - 30)} fontSize="10" fill="#2F6FDB">
            {r}
          </text>
        </g>
      ))}
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#FF6B3D" strokeWidth="3" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="5" fill={values[i] <= 3 ? '#ffcf4a' : '#fff'} stroke="#FF6B3D" strokeWidth="2" />
      ))}
    </svg>
  );
}
function Bars({ data }: { data: { label: string; v: number; color?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
          <div className="num">{d.v}</div>
          <div style={{ height: (d.v / max) * 92 + 2, background: d.color ?? 'linear-gradient(#CFE6FF,#FF6B3D)', borderRadius: '8px 8px 4px 4px' }} />
          <div>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { profile, member } = useProfile();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    getShell().showroom.setMode('menu');
    music.play('dashboard');
  }, []);
  return (
    <div className="screen">
      <TopBar title="📊 대시보드" />
      {!member && <div className="chip" style={{ alignSelf: 'flex-start', marginTop: 6 }}>💾 회원가입하면 기록이 서버에 영구 저장돼요</div>}
      <div className="tabs" style={{ marginTop: 8 }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="panel scroll" style={{ flex: 1, marginTop: 8, padding: 16 }}>
        {tab === 'overview' && <Overview />}
        {tab === 'races' && <RaceTable races={profile.races} />}
        {tab === 'tracks' && <TrackTab />}
        {tab === 'ranking' && <Ranking />}
        {tab === 'combos' && <Combos races={profile.races} />}
        {tab === 'items' && <ItemsTab races={profile.races} />}
        {tab === 'ledger' && <Ledger />}
        {tab === 'ach' && <Achievements />}
      </div>
    </div>
  );
}

function Overview() {
  const p = useProfile((s) => s.profile);
  const races = p.races.filter((r) => r.mode === 'race');
  const wins = races.filter((r) => r.position === 1).length;
  const top3 = races.filter((r) => r.position <= 3).length;
  const avg = races.length ? races.reduce((a, r) => a + r.position, 0) / races.length : 0;
  const stars = Object.values(p.stars).reduce((a, b) => a + countStars(b), 0);
  const last10 = races.slice(0, 10).reverse().map((r) => r.position);
  const dist = Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1}위`, v: races.filter((r) => r.position === i + 1).length }));
  const tile = (label: string, value: string, icon: string) => (
    <div className="card" style={{ cursor: 'default', padding: 10, minWidth: 130 }}>
      <div style={{ fontSize: 13, color: '#2F6FDB' }}>
        {icon} {label}
      </div>
      <div className="num" style={{ fontSize: 24 }}>
        {value}
      </div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {tile('총 레이스', String(p.races.length), '🏁')}
        {tile('1등 횟수', String(wins), '🏆')}
        {tile('3위 이내율', races.length ? `${Math.round((top3 / races.length) * 100)}%` : '-', '🥉')}
        {tile('평균 순위', races.length ? avg.toFixed(2) : '-', '📈')}
        {tile('총 플레이 시간', `${Math.floor(p.totalPlayMs / 60000)}분`, '⏱️')}
        {tile('보유 골드', p.gold.toLocaleString(), '🪙')}
        {tile('누적 획득', p.goldEarned.toLocaleString(), '💰')}
        {tile('누적 사용', p.goldSpent.toLocaleString(), '🛍️')}
        {tile('레벨', `Lv.${p.level} (${p.xp}xp)`, '✨')}
        {tile('별 수집', `${stars} / 24`, '⭐')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 14 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <b>최근 10판 순위 추이</b>
          {last10.length ? <LineChart values={last10} /> : <p>아직 기록이 없어요</p>}
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <b>순위 분포</b>
          <Bars data={dist} />
        </div>
      </div>
    </div>
  );
}

function RaceTable({ races }: { races: RaceRecord[] }) {
  const [fTrack, setFTrack] = useState('');
  const [fMode, setFMode] = useState('');
  const [fChar, setFChar] = useState('');
  const [fVeh, setFVeh] = useState('');
  const [fDays, setFDays] = useState(0);
  const [sort, setSort] = useState<'at' | 'position' | 'totalMs' | 'gold'>('at');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<RaceRecord | null>(null);
  const rows = useMemo(() => {
    let r = races.filter((x) => (!fTrack || x.trackId === fTrack) && (!fMode || x.mode === fMode) && (!fChar || x.charId === fChar) && (!fVeh || x.vehicleId === fVeh) && (!fDays || x.at > Date.now() - fDays * 864e5));
    r = [...r].sort((a, b) => (sort === 'at' ? b.at - a.at : sort === 'gold' ? b.gold - a.gold : (a[sort] as number) - (b[sort] as number)));
    return r;
  }, [races, fTrack, fMode, fChar, fVeh, fDays, sort]);
  const per = 12;
  const view = rows.slice(page * per, page * per + per);
  const sel = (v: string, set: (x: string) => void, opts: [string, string][], label: string) => (
    <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 14 }} value={v} onChange={(e) => (set(e.target.value), setPage(0))}>
      <option value="">{label}</option>
      {opts.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
  if (detail) {
    return (
      <div>
        <button className="btn small ghost" onClick={() => setDetail(null)}>
          ◀ 목록
        </button>
        <h3>
          {TRACK_BY_ID[detail.trackId]?.name} · {new Date(detail.at).toLocaleString()} · {detail.position}위
        </h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280 }}>
            <b>최종 순위</b>
            {[...detail.entrants].sort((a, b) => a.position - b.position).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: e.isPlayer ? '#EEF6FF' : undefined, borderRadius: 8, padding: 2 }}>
                <b style={{ width: 20 }}>{e.position}</b>
                <img src={portrait(e.charId as CharId, {}, 48)} style={{ width: 26 }} alt="" />
                <span style={{ flex: 1 }}>{CHAR_BY_ID[e.charId as CharId]?.name}</span>
                <small>{VEHICLE_BY_ID[e.vehicleId]?.name}</small>
                <span className="num">{fmtMs(e.totalMs)}</span>
              </div>
            ))}
          </div>
          <div>
            <b>랩별 타임</b>
            {detail.lapTimes.map((l, i) => (
              <div key={i}>
                {i + 1}랩: <span className="num">{fmtMs(l)}</span>
              </div>
            ))}
            <b style={{ display: 'block', marginTop: 10 }}>아이템 사용 / 명중 / 피격</b>
            {Object.entries(detail.items).map(([id, s]) => (
              <div key={id}>
                {ALL_ITEMS[id]?.icon ?? '💥'} {ALL_ITEMS[id]?.name ?? (id === 'hazard' ? '트랙 기믹' : id)}: {s.used} / {s.hits} / {s.gotHit}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {sel(fTrack, setFTrack, TRACKS.map((t) => [t.id, t.name]), '전체 트랙')}
        {sel(fMode, setFMode, [['race', '대전'], ['timeattack', '타임어택'], ['practice', '연습']], '전체 모드')}
        {sel(fChar, setFChar, CHARACTERS.map((c) => [c.id, c.name]), '전체 캐릭터')}
        {sel(fVeh, setFVeh, Object.values(VEHICLE_BY_ID).map((v) => [v.id, v.name]), '전체 차량')}
        <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 14 }} value={fDays} onChange={(e) => setFDays(+e.target.value)}>
          <option value={0}>전체 기간</option>
          <option value={1}>오늘</option>
          <option value={7}>7일</option>
          <option value={30}>30일</option>
        </select>
        <select className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: 14 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="at">최신순</option>
          <option value="position">순위순</option>
          <option value="totalMs">시간순</option>
          <option value="gold">골드순</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ color: '#2F6FDB', textAlign: 'left' }}>
            <th>날짜</th>
            <th>모드</th>
            <th>트랙</th>
            <th>난이도</th>
            <th>캐릭터</th>
            <th>차량</th>
            <th>순위</th>
            <th>총 시간</th>
            <th>베스트 랩</th>
            <th>골드</th>
          </tr>
        </thead>
        <tbody>
          {view.map((r) => (
            <tr key={r.id} onClick={() => setDetail(r)} style={{ cursor: 'pointer', borderTop: '1px solid #E8EFF8' }}>
              <td>{new Date(r.at).toLocaleDateString()}</td>
              <td>{r.mode === 'race' ? '대전' : r.mode === 'timeattack' ? '타임어택' : '연습'}</td>
              <td>{TRACK_BY_ID[r.trackId]?.name}</td>
              <td>{DIFF[r.difficulty]?.label}</td>
              <td>{CHAR_BY_ID[r.charId]?.name}</td>
              <td>{VEHICLE_BY_ID[r.vehicleId]?.name}</td>
              <td>
                <b>{r.position}</b>
              </td>
              <td className="num">{fmtMs(r.totalMs)}</td>
              <td className="num">{fmtMs(r.bestLapMs)}</td>
              <td className="num">{r.gold.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>기록이 없어요. 레이스를 달려 보세요!</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button className="btn small ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
          ◀
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(rows.length / per))}
        </span>
        <button className="btn small ghost" disabled={(page + 1) * per >= rows.length} onClick={() => setPage(page + 1)}>
          ▶
        </button>
      </div>
    </div>
  );
}

function TrackTab() {
  const p = useProfile((s) => s.profile);
  const { set } = useApp();
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
      {TRACKS.map((t) => {
        const rs = p.races.filter((r) => r.trackId === t.id);
        const best = p.bestRace[t.id];
        const ta = p.bestTA[t.id];
        const medal = ta ? medalFor(t.id, ta.ms) : null;
        return (
          <div key={t.id} className="card" style={{ cursor: 'default' }}>
            <img src={trackImage(t, 300, 120)} style={{ width: '100%', borderRadius: 12 }} alt="" />
            <b>
              {t.no}. {t.name}
            </b>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <Stars n={countStars(p.stars[t.id] ?? 0)} size={14} /> · 플레이 {rs.length}회
              <br />
              최고 순위 {best ? `${best.pos}위` : '-'} · 베스트 {best ? fmtMs(best.ms) : '-'} · 베스트 랩 {best ? fmtMs(best.lap) : '-'}
              <br />
              타임어택 {ta ? fmtMs(ta.ms) : '-'} {medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : ''}
            </div>
            {p.unlockedTracks.includes(t.id) && (
              <button
                className="btn small sky"
                style={{ marginTop: 6 }}
                onClick={() => {
                  set({ mode: 'timeattack', trackId: t.id });
                  startRaceFlow(t.id, 'timeattack', 'normal');
                }}
              >
                👻 고스트와 대결
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Ranking() {
  const { profile, member, server } = useProfile();
  const [track, setTrack] = useState('t1');
  const [rows, setRows] = useState<{ rank: number; nickname: string; totalMs: number; userId: string; vehicleId: string; charId: string }[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setRows(null);
    setErr('');
    if (!server) {
      setErr('오프라인 모드에서는 글로벌 랭킹을 볼 수 없어요.');
      return;
    }
    api<{ rows: typeof rows }>(`timeattack/leaderboard?track=${track}`)
      .then((r) => setRows(r.rows ?? []))
      .catch((e) => setErr(e.message));
  }, [track, server]);
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 8 }}>
        {TRACKS.map((t) => (
          <button key={t.id} className={`tab ${track === t.id ? 'on' : ''}`} onClick={() => setTrack(t.id)} style={{ fontSize: 13 }}>
            {t.no}
          </button>
        ))}
      </div>
      <h3 style={{ margin: '4px 0' }}>🏆 {TRACK_BY_ID[track].name} 타임어택 TOP 100</h3>
      {err && <p>{err}</p>}
      {!member && <p style={{ color: '#2F6FDB' }}>랭킹 등록은 회원 전용이에요.</p>}
      {rows?.map((r) => (
        <div key={r.userId} style={{ display: 'flex', gap: 10, padding: 4, borderRadius: 8, background: r.userId === profile.userId ? '#fff0b8' : undefined, alignItems: 'center' }}>
          <b style={{ width: 34 }}>{r.rank}</b>
          <img src={portrait(r.charId as CharId, {}, 48)} style={{ width: 26 }} alt="" />
          <span style={{ flex: 1 }}>{r.nickname}</span>
          <small>{VEHICLE_BY_ID[r.vehicleId]?.name}</small>
          <span className="num">{fmtMs(r.totalMs)}</span>
          <button
            className="btn small ghost"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={async () => {
              try {
                const g = await api<{ ghost: string }>(`timeattack/ghost?track=${track}&user=${r.userId}`);
                startRaceFlow(track, 'timeattack', 'normal', unb64(g.ghost));
              } catch {
                /* ignore */
              }
            }}
          >
            👻 대결
          </button>
        </div>
      ))}
      {rows && !rows.length && <p>아직 기록이 없어요. 첫 번째 기록의 주인공이 되어 보세요!</p>}
      {profile.bestTA[track] && <p>내 기록: {fmtMs(profile.bestTA[track].ms)}</p>}
    </div>
  );
}

function Combos({ races }: { races: RaceRecord[] }) {
  const rr = races.filter((r) => r.mode === 'race');
  const agg = (key: 'charId' | 'vehicleId') => {
    const m = new Map<string, { n: number; wins: number; pos: number }>();
    for (const r of rr) {
      const k = r[key];
      const v = m.get(k) ?? { n: 0, wins: 0, pos: 0 };
      v.n++;
      v.pos += r.position;
      if (r.position === 1) v.wins++;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  };
  const combo = new Map<string, { n: number; pos: number }>();
  for (const r of rr) {
    const k = r.charId + '|' + r.vehicleId;
    const v = combo.get(k) ?? { n: 0, pos: 0 };
    v.n++;
    v.pos += r.position;
    combo.set(k, v);
  }
  const best = [...combo.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => a[1].pos / a[1].n - b[1].pos / b[1].n)[0];
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {best && (
        <div className="card" style={{ cursor: 'default', width: '100%' }}>
          💡 추천 조합: <b>{CHAR_BY_ID[best[0].split('|')[0] as CharId].name} + {VEHICLE_BY_ID[best[0].split('|')[1]].name}</b> (평균 {(best[1].pos / best[1].n).toFixed(2)}위)
        </div>
      )}
      {(['charId', 'vehicleId'] as const).map((k) => (
        <div key={k} style={{ flex: 1, minWidth: 280 }}>
          <b>{k === 'charId' ? '캐릭터' : '차량'} 통계</b>
          {agg(k).map(([id, v]) => (
            <div key={id} style={{ display: 'flex', gap: 8, fontSize: 14 }}>
              <span style={{ flex: 1 }}>{k === 'charId' ? CHAR_BY_ID[id as CharId]?.name : VEHICLE_BY_ID[id]?.name}</span>
              <span>{v.n}회</span>
              <span>승률 {Math.round((v.wins / v.n) * 100)}%</span>
              <span>평균 {(v.pos / v.n).toFixed(1)}위</span>
            </div>
          ))}
          {!agg(k).length && <p>기록 없음</p>}
        </div>
      ))}
    </div>
  );
}

function ItemsTab({ races }: { races: RaceRecord[] }) {
  const m = new Map<string, { used: number; hits: number; gotHit: number }>();
  for (const r of races)
    for (const [id, s] of Object.entries(r.items)) {
      const v = m.get(id) ?? { used: 0, hits: 0, gotHit: 0 };
      v.used += s.used;
      v.hits += s.hits;
      v.gotHit += s.gotHit;
      m.set(id, v);
    }
  const rows = [...m.entries()].sort((a, b) => b[1].used - a[1].used);
  const mostHit = [...m.entries()].sort((a, b) => b[1].gotHit - a[1].gotHit)[0];
  return (
    <div>
      {mostHit && mostHit[1].gotHit > 0 && <div className="chip">😵 가장 많이 맞은 아이템: {ALL_ITEMS[mostHit[0]]?.name ?? '트랙 기믹'} ({mostHit[1].gotHit}회)</div>}
      <table style={{ width: '100%', fontSize: 14, marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#2F6FDB' }}>
            <th>아이템</th>
            <th>사용</th>
            <th>명중</th>
            <th>명중률</th>
            <th>피격</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, s]) => (
            <tr key={id}>
              <td>
                {ALL_ITEMS[id]?.icon ?? '💥'} {ALL_ITEMS[id]?.name ?? (id === 'hazard' ? '트랙 기믹' : id)}
              </td>
              <td>{s.used}</td>
              <td>{s.hits}</td>
              <td>{s.used ? `${Math.round((s.hits / s.used) * 100)}%` : '-'}</td>
              <td>{s.gotHit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>아직 아이템 기록이 없어요</p>}
    </div>
  );
}

function Ledger() {
  const p = useProfile((s) => s.profile);
  return (
    <div>
      {p.ledger.slice(0, 200).map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, borderBottom: '1px solid #EDF2F9', padding: '3px 0' }}>
          <span style={{ width: 150, color: '#2F6FDB' }}>{new Date(l.t).toLocaleString()}</span>
          <span style={{ flex: 1 }}>{l.reason}</span>
          <b className="num" style={{ color: l.delta >= 0 ? '#3cb36a' : '#E8412C' }}>
            {l.delta >= 0 ? '+' : ''}
            {l.delta.toLocaleString()}
          </b>
        </div>
      ))}
    </div>
  );
}

export function Achievements() {
  const p = useProfile((s) => s.profile);
  const bar = (v: number, g: number) => (
    <div style={{ height: 8, background: '#E3ECF7', borderRadius: 5, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${Math.min(100, (v / g) * 100)}%`, height: '100%', background: v >= g ? '#7bd389' : 'linear-gradient(90deg,#CFE6FF,#2F6FDB)' }} />
    </div>
  );
  return (
    <div>
      <b>오늘의 미션</b>
      {p.daily.missions.map((m) => (
        <div key={m.id} style={{ margin: '6px 0' }}>
          {MISSION_BY_ID[m.id]?.text} ({m.progress}/{MISSION_BY_ID[m.id]?.goal}) {m.claimed ? '✅' : ''}
          {bar(m.progress, MISSION_BY_ID[m.id]?.goal ?? 1)}
        </div>
      ))}
      <b style={{ display: 'block', marginTop: 12 }}>
        업적 ({Object.values(p.achievements).filter((a) => a.done).length}/{ACHIEVEMENTS.length})
      </b>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 6 }}>
        {ACHIEVEMENTS.map((a) => {
          const st = p.achievements[a.id];
          return (
            <div key={a.id} className="card" style={{ cursor: 'default', padding: 8, opacity: st?.done ? 1 : 0.85 }}>
              <div style={{ fontSize: 14 }}>
                {st?.done ? '🏅' : '🔸'} {a.name}
              </div>
              <div style={{ fontSize: 12, color: '#4B5A78' }}>
                {a.desc} · 🪙{a.reward.toLocaleString()}
                {a.title ? ` · 칭호「${a.title}」` : ''}
              </div>
              {bar(st?.p ?? 0, a.goal)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
