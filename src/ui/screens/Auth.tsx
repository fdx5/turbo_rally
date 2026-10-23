import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { Modal, sfx } from '../common';
import { audio } from '../../audio/engine';

const BANNED = ['바보', '멍청', '시발', 'fuck', 'shit', '병신', '개새'];
export function validateSignup(id: string, pw: string, pw2: string, nick: string): string | null {
  if (!/^[a-z0-9_]{4,16}$/.test(id)) return '아이디는 4~16자의 영소문자·숫자·_ 만 쓸 수 있어요';
  if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw))
    return '비밀번호는 8자 이상, 영문과 숫자를 섞어 주세요';
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
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (err && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [err]);
  // Scroll only the form body: Safari may pan its visual viewport when the keyboard opens.
  useEffect(() => {
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.activeElement;
        const container = body.current;
        if (!(el instanceof HTMLInputElement) || !container?.contains(el)) return;
        const field = el.getBoundingClientRect(),
          area = container.getBoundingClientRect();
        if (field.bottom > area.bottom - 4) container.scrollTop += field.bottom - area.bottom + 4;
        else if (field.top < area.top + 4) container.scrollTop -= area.top - field.top + 4;
      });
    };
    body.current?.addEventListener('focusin', reveal);
    window.addEventListener('gameviewportchange', reveal);
    const container = body.current;
    return () => {
      cancelAnimationFrame(frame);
      container?.removeEventListener('focusin', reveal);
      window.removeEventListener('gameviewportchange', reveal);
    };
  }, []);
  const submit = async () => {
    if (busy) return;
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
    <Modal
      className="auth-modal"
      label={kind === 'login' ? '로그인' : '회원가입'}
      onClose={() => set({ modal: null })}
    >
      <header className="auth-header">
        <h2>{kind === 'login' ? '로그인 🔑' : '회원가입 🎀'}</h2>
        <button
          type="button"
          className="btn icon ghost"
          aria-label="닫기"
          onClick={() => set({ modal: null })}
        >
          ✕
        </button>
      </header>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="auth-body" ref={body}>
          {kind === 'signup' && <p className="auth-benefit">가입 선물: 5,000G + 웰컴 리본 모자</p>}
          {!server && <p className="auth-warning">서버에 연결할 수 없어요. 연결 후 다시 시도해 주세요.</p>}
          <div className="auth-fields">
            <label>
              아이디
              <input
                className="input"
                name="username"
                placeholder="영소문자·숫자·_ 4~16자"
                required
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase())}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
              />
            </label>
            <label>
              비밀번호
              <input
                className="input"
                name="password"
                type="password"
                placeholder={kind === 'signup' ? '8자 이상, 영문 + 숫자' : '비밀번호 입력'}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete={kind === 'login' ? 'current-password' : 'new-password'}
                enterKeyHint={kind === 'login' ? 'go' : 'next'}
              />
            </label>
            {kind === 'signup' && (
              <>
                <label>
                  비밀번호 확인
                  <input
                    className="input"
                    name="password-confirm"
                    type="password"
                    placeholder="비밀번호 다시 입력"
                    required
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    enterKeyHint="next"
                  />
                </label>
                <label>
                  닉네임
                  <input
                    className="input"
                    name="nickname"
                    placeholder="2~10자, 한글 가능"
                    required
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    maxLength={10}
                    autoComplete="nickname"
                    enterKeyHint="go"
                  />
                </label>
              </>
            )}
          </div>
          {kind === 'login' && (
            <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{' '}
              로그인 유지 (30일)
            </label>
          )}
          {err && (
            <div className="auth-error" role="alert">
              {err}
            </div>
          )}
        </div>
        <footer className="auth-actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? '잠시만요…' : kind === 'login' ? '로그인' : '가입하기'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => set({ modal: kind === 'login' ? 'signup' : 'login' })}
          >
            {kind === 'login' ? '회원가입' : '로그인'}
          </button>
        </footer>
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
        <h2 style={{ margin: 0, fontSize: 30 }}>
          {gate ? '계속 달리려면 회원가입이 필요해요!' : '회원가입하고 선물 받아요!'}
        </h2>
        <ul style={{ textAlign: 'left', fontSize: 19, lineHeight: 1.7 }}>
          <li>
            🪙 가입 보너스 <b>5,000G</b>
          </li>
          <li>
            🎩 한정 아이템 <b>「웰컴 리본 모자」</b>
          </li>
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
        {gate && (
          <p style={{ fontSize: 14, color: '#2F6FDB' }}>
            타임어택·연습 주행은 게스트도 계속 즐길 수 있어요 (타임어택 하루 3회)
          </p>
        )}
      </div>
    </Modal>
  );
}
