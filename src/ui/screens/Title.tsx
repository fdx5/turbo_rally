import { useEffect } from 'react';
import { useApp } from '../../game/app';
import { useProfile } from '../../net/profileStore';
import { getShell } from '../../game/shell';
import { music } from '../../audio/music';
import { audio } from '../../audio/engine';
import { say } from '../../audio/voice';
import { sfx } from '../common';
import { Logo } from '../Logo';
import { I } from '../icons';
import { InstallButton, FullscreenButton } from '../MobileDisplay';

export function Loading() {
  const { loadingMsg, loadingPct } = useApp();
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', background: 'repeating-linear-gradient(135deg,#D6EAFF 0 40px,#C9E3FF 40px 80px)' }}>
      <div style={{ animation: 'bob 2s ease-in-out infinite' }}>
        <Logo width={Math.min(420, window.innerWidth * 0.6)} />
      </div>
      <div className="meter" style={{ width: 'min(420px, 70vw)', height: 20, marginTop: 30 }}>
        <i style={{ width: `${loadingPct}%`, transition: 'width .3s' }} />
      </div>
      <div className="chip" style={{ marginTop: 14 }}>{loadingMsg}</div>
      <p style={{ fontSize: 16 }}>팁 — 카운트다운 「2」가 보일 때 가속하면 로켓 스타트!</p>
    </div>
  );
}

export function Title() {
  const { go, set } = useApp();
  const { member, profile, server } = useProfile();
  useEffect(() => {
    const sh = getShell();
    sh.showroom.setMode('title');
    sh.showroom.setKart(profile.selectedVehicle, profile.selectedChar, profile.equipment[profile.selectedChar] ?? {});
  }, [profile.selectedVehicle, profile.selectedChar, profile.equipment]);
  const start = () => {
    void audio.unlock();
    music.play('menu');
    sfx.click();
    say(profile.selectedChar, 'select', { tts: false, vol: 0.8 });
    go('menu');
  };
  return (
    <div className="screen title-screen" style={{ justifyContent: 'center' }}>
      <div className="title-content" style={{ marginLeft: '5vw', maxWidth: 520 }}>
        <div className="pop-in">
          <Logo width={Math.min(480, window.innerWidth * 0.42)} />
        </div>
        <div className="chip" style={{ margin: '18px 0 26px', fontSize: 18, transform: 'rotate(-2deg)' }}>
          8인 파스텔 카트 레이싱 · 드리프트 · 아이템 배틀
        </div>
        <div className="title-actions" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
          <button className="btn big" onClick={start}>
            <I name="play" size={26} />
            {member ? `${profile.nickname}(으)로 시작` : '게스트로 시작'}
          </button>
          {!member && (
            <div className="title-auth-actions" style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn sky"
                onClick={() => {
                  void audio.unlock();
                  sfx.click();
                  set({ modal: 'login' });
                }}
              >
                로그인
              </button>
              <button
                className="btn mint"
                onClick={() => {
                  void audio.unlock();
                  sfx.click();
                  set({ modal: 'signup' });
                }}
              >
                회원가입
              </button>
            </div>
          )}
          <div className="mobile-display-actions"><InstallButton /><FullscreenButton /></div>
          {!server && <div className="chip" style={{ fontSize: 14 }}>오프라인 모드 · 게스트 진행도는 이 기기에 저장돼요</div>}
        </div>
      </div>
    </div>
  );
}
