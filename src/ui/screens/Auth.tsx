import { useState } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { Modal, sfx } from '../common';
import { audio } from '../../audio/engine';

const BANNED = ['바보', '멍청', '시발', 'fuck', 'shit', '병신', '개새'];
export function validateSignup(id: string, pw: string, pw2: string, nick: string): string | null {
  if (!/^[a-z0-9_]{4,16}$/.test(id)) return '아이디는 4~16자의 영소문자·숫자·_ 만 쓸 수 있어요';
  if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return '비밀번호는 8자 이상, 영문과 숫자를 섞어 주세요';
  if (pw !== pw2) return '비밀번호 확인이 달라요';
  if (nick.length < 2 || nick.length > 10) return '닉네임은 2~10자로 해 주세요';
  if (BANNED.some((b) => nick.toLowerCase().includes(b))) return '사용할 수 없는 닉네임이에요';
  return null;
}

export function AuthModal({ kind }: { kind: 'login' | 'signup' }) {
  const set = useApp((s) => s.set);
  const { login, signup, server } = useProfile();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [nick, setNick] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr('');
    if (kind === 'signup') {
      const v = validateSignup(id, pw, pw2, nick);
      if (v) {
        sfx.error();
        return setErr(v);
      }
    }
    setBusy(true);
    const e = kind === 'login' ? await login(id, pw, remember) : await signup(id, pw, nick);
    setBusy(false);
    if (e) {
      sfx.error();
      setErr(e);
    } else {
      audio.play(kind === 'signup' ? 'unlock' : 'itemGet');
      set({ modal: null });
    }
  };
  return (
    <Modal onClose={() => set({ modal: null })}>
      <h2 style={{ margin: '0 0 6px', fontSize: 30 }}>{kind === 'login' ? '로그인 🔑' : '회원가입 🎀'}</h2>
      {kind === 'signup' && <p style={{ margin: '0 0 12px', color: '#9d7bc9' }}>가입하면 5,000G + 한정 「웰컴 리본 모자」를 드려요!</p>}
      {!server && <p style={{ color: '#ff6b8a' }}>지금은 서버에 연결할 수 없어요 (오프라인 모드).</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input className="input" placeholder="아이디 (영소문자·숫자·_ 4~16자)" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} autoComplete="username" />
        <input className="input" type="password" placeholder="비밀번호 (8자 이상, 영문+숫자)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={kind === 'login' ? 'current-password' : 'new-password'} />
        {kind === 'signup' && (
          <>
            <input className="input" type="password" placeholder="비밀번호 확인" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            <input className="input" placeholder="닉네임 (2~10자, 한글 가능)" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={10} />
          </>
        )}
        {kind === 'login' && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> 로그인 유지 (30일)
          </label>
        )}
        {err && <div style={{ color: '#ff4d7e' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? '잠시만요…' : kind === 'login' ? '로그인' : '가입하기'}
          </button>
          <button type="button" className="btn ghost" onClick={() => set({ modal: kind === 'login' ? 'signup' : 'login' })}>
            {kind === 'login' ? '회원가입' : '로그인'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PromoModal({ gate }: { gate?: boolean }) {
  const set = useApp((s) => s.set);
  const go = useApp((s) => s.go);
  return (
    <Modal onClose={gate ? undefined : () => set({ modal: null })}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64 }}>🎀</div>
        <h2 style={{ margin: 0, fontSize: 30 }}>{gate ? '계속 달리려면 회원가입이 필요해요!' : '회원가입하고 선물 받아요!'}</h2>
        <ul style={{ textAlign: 'left', fontSize: 19, lineHeight: 1.7 }}>
          <li>🪙 가입 보너스 <b>5,000G</b></li>
          <li>🎩 한정 아이템 <b>「웰컴 리본 모자」</b></li>
          <li>🏆 랭킹 등록 · 기기 간 이어하기</li>
          <li>🛍️ 상점 이용 & 트랙 4~8 해금</li>
        </ul>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn big mint" onClick={() => set({ modal: 'signup' })}>
            지금 가입
          </button>
          {gate ? (
            <button
              className="btn ghost"
              onClick={() => {
                set({ modal: null });
                go('menu');
              }}
            >
              메뉴로
            </button>
          ) : (
            <button className="btn ghost" onClick={() => set({ modal: null })}>
              나중에
            </button>
          )}
        </div>
        {gate && <p style={{ fontSize: 14, color: '#9d7bc9' }}>타임어택·연습 주행은 게스트도 계속 즐길 수 있어요 (타임어택 하루 3회)</p>}
      </div>
    </Modal>
  );
}
