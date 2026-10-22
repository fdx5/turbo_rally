import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '../ui/styles.css';
import { audio } from '../audio/engine';
import { music, SONGS, renderSong } from '../audio/music';
import { SFX_RECIPES, type SfxId, type Recipe } from '../audio/sfx';
import { say } from '../audio/voice';
import { CHARACTERS, type VoiceLine } from '../data/characters';
import { loadFonts } from '../art/fonts';

// Exposed only by this development audition page for waveform/peak QA.
if (new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { audioReview: { audio, recipes: SFX_RECIPES, music, songs: SONGS, renderSong } });
}

/**
 * /dev/audio-review.html — §9.1-4 human approval step. Every sound grouped by in-game context with
 * ▶ play / ✅ approve / ❌ reject. Rejected entries show 2 alternative candidates to audition.
 * Decisions persist in localStorage and can be exported as JSON.
 */
type Verdict = 'ok' | 'no' | undefined;
const KEY = 'tr.audioReview.v1';
const load = (): Record<string, Verdict | string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};
interface Entry {
  id: string;
  group: string;
  label: string;
  detail?: string;
  play: (variant?: number) => void;
}
const LINE_LABEL: Record<VoiceLine, string> = { select: '선택', start: '레이스 시작', boost: '부스트', hitOther: '아이템 맞힘', ouch: '피격', overtake: '추월', overtaken: '역전당함', win: '1등 결승', lose: '하위 결승', thanks: '구매 감사', skill: '고유기' };

function entries(manifest: Record<string, Record<string, { text: string; asr: string; cer: number }>>): Entry[] {
  const out: Entry[] = [];
  for (const s of Object.values(SONGS))
    out.push({
      id: 'bgm:' + s.id,
      group: 'BGM',
      label: `${s.name}`,
      detail: `${s.mood} · ${s.bpm} BPM`,
      play: (v) => {
        music.play(s.id, 0.2);
        if (v) music.setTempo(v === 1 ? 0.92 : 1.08);
      },
    });
  for (const id of Object.keys(SFX_RECIPES) as SfxId[]) {
    const r = SFX_RECIPES[id] as Recipe;
    out.push({ id: 'sfx:' + id, group: `효과음 · ${r.context}`, label: r.label, play: (v) => audio.play(id, { vary: false, rate: v === 1 ? 0.84 : v === 2 ? 1.19 : 1 }) });
  }
  for (const c of CHARACTERS)
    for (const line of Object.keys(c.lines) as VoiceLine[]) {
      const m = manifest[c.id]?.[line];
      out.push({
        id: `voice:${c.id}:${line}`,
        group: `보이스 · ${c.name}`,
        label: `${LINE_LABEL[line]} — "${c.lines[line]}"`,
        detail: m ? `음성인식 검수: "${m.asr}" (CER ${m.cer})` : '',
        play: () => say(c.id, line),
      });
    }
  return out;
}

function App() {
  const [st, setSt] = useState(load);
  const [manifest, setManifest] = useState({});
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    fetch('/audio/voice/manifest.json')
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => {});
  }, []);
  const list = entries(manifest);
  const set = (id: string, v: Verdict) => {
    const n = { ...st, [id]: v };
    setSt(n);
    localStorage.setItem(KEY, JSON.stringify(n));
  };
  const groups = [...new Set(list.map((e) => e.group))];
  const ok = list.filter((e) => st[e.id] === 'ok').length;
  const no = list.filter((e) => st[e.id] === 'no').length;
  const shown = list.filter((e) => filter === 'all' || (filter === 'todo' && !st[e.id]) || st[e.id] === filter);
  return (
    <div style={{ height: '100%', overflowY: 'auto', touchAction: 'pan-y', padding: 20, background: 'repeating-linear-gradient(135deg,#F2F8FF 0 30px,#E4F0FF 30px 60px)' }}>
      <div className="topbar" style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff8ee', border: '3px solid #1E2B4A', borderRadius: 16, padding: 10, boxShadow: '0 5px 0 #1E2B4A' }}>
        <h1 style={{ fontSize: 28 }}>사운드 리뷰</h1>
        <span className="chip">전체 {list.length}</span>
        <span className="chip" style={{ color: '#3fc46e' }}>승인 {ok}</span>
        <span className="chip" style={{ color: '#FF5A36' }}>반려 {no}</span>
        <div className="spacer" />
        {(['all', 'todo', 'ok', 'no'] as const).map((f) => (
          <button key={f} className={`tab ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {{ all: '전체', todo: '미검토', ok: '승인', no: '반려' }[f]}
          </button>
        ))}
        <button className="btn small ghost" onClick={() => music.stop()}>
          BGM 정지
        </button>
        <button
          className="btn small"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ at: new Date().toISOString(), verdicts: st }, null, 1)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'audio-review.json';
            a.click();
          }}
        >
          결과 내보내기
        </button>
      </div>
      {groups.map((g) => {
        const items = shown.filter((e) => e.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="panel" style={{ margin: '16px 0', padding: 12 }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--head)', fontWeight: 400 }}>{g}</h3>
            {items.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '2px dashed #E3ECF7', flexWrap: 'wrap' }}>
                <button className="btn small sky" onClick={() => audio.unlock().then(() => e.play())}>
                  ▶ 재생
                </button>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div>{e.label}</div>
                  {e.detail && <small style={{ color: '#4B5A78' }}>{e.detail}</small>}
                </div>
                <button className={`btn small ${st[e.id] === 'ok' ? 'mint' : 'ghost'}`} onClick={() => set(e.id, st[e.id] === 'ok' ? undefined : 'ok')}>
                  ✅ 승인
                </button>
                <button className={`btn small ${st[e.id] === 'no' ? '' : 'ghost'}`} onClick={() => set(e.id, st[e.id] === 'no' ? undefined : 'no')}>
                  ❌ 반려
                </button>
                {st[e.id] === 'no' && (
                  <div style={{ display: 'flex', gap: 6, width: '100%', paddingLeft: 90 }}>
                    <span style={{ fontSize: 14 }}>대체 후보:</span>
                    {e.group.startsWith('보이스') ? (
                      <span style={{ fontSize: 14 }}>메모를 남겨 주시면 해당 대사를 다시 녹음(재생성)합니다 →</span>
                    ) : (
                      [1, 2].map((v) => (
                        <button key={v} className="btn small lav" onClick={() => audio.unlock().then(() => e.play(v))}>
                          후보 {v === 1 ? 'A (낮고 부드럽게)' : 'B (높고 경쾌하게)'}
                        </button>
                      ))
                    )}
                    <input
                      className="input"
                      style={{ padding: '4px 8px', fontSize: 14, maxWidth: 280 }}
                      placeholder="메모 (예: 너무 날카로움)"
                      value={(st[e.id + ':memo'] as string) ?? ''}
                      onChange={(ev) => {
                        const n = { ...st, [e.id + ':memo']: ev.target.value };
                        setSt(n);
                        localStorage.setItem(KEY, JSON.stringify(n));
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
await loadFonts();
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
createRoot(document.getElementById('root')!).render(<App />);
