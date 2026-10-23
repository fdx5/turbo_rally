import { useEffect, useState } from 'react';
import { isIOS, isStandalone, requestGameFullscreen, showInstallHelp } from '../core/mobileDisplay';
import { useApp } from '../game/app';
import { input } from '../core/input';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let pendingInstall: InstallPrompt | null = null;
// Listen at module load; the browser can make installation available before App's effects run.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pendingInstall = event as InstallPrompt;
  window.dispatchEvent(new Event('gameinstallavailable'));
});
export function InstallButton() {
  if (isStandalone()) return null;
  return (
    <button type="button" className="btn small install-button" onClick={showInstallHelp}>
      홈 화면에 추가
    </button>
  );
}
export function FullscreenButton() {
  if (isStandalone() || (isIOS() && !document.documentElement.requestFullscreen)) return null;
  return (
    <button
      type="button"
      className="btn small ghost fullscreen-button"
      onClick={() => void requestGameFullscreen()}
    >
      ⛶ 전체화면
    </button>
  );
}
export function MobileDisplay() {
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [available, setAvailable] = useState(!!pendingInstall);
  const screenName = useApp((s) => s.screen);
  useEffect(() => {
    const show = () => {
      input.reset();
      setOpen(true);
    };
    const ready = () => setAvailable(!!pendingInstall);
    const installed = () => {
      pendingInstall = null;
      setOpen(false);
      setAvailable(false);
    };
    window.addEventListener('gameinstallhelp', show);
    window.addEventListener('gameinstallavailable', ready);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('gameinstallhelp', show);
      window.removeEventListener('gameinstallavailable', ready);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  // No installation modal over an actively driving player; entry points are menus/settings.
  useEffect(() => {
    if (screenName === 'race') setOpen(false);
  }, [screenName]);
  if (!open) return null;
  const install = async () => {
    const prompt = pendingInstall;
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setOpen(false);
    } catch {
      /* Keep the browser-menu instructions visible if installation is rejected. */
    } finally {
      pendingInstall = null;
      setAvailable(false);
      setInstalling(false);
    }
  };
  return (
    <div className="modal-bg install-help" role="dialog" aria-modal="true" aria-labelledby="install-heading">
      <div className="panel modal">
        <h2 id="install-heading">주소창 없이 가로로 플레이</h2>
        {isIOS() ? (
          <>
            <p>한 번 추가하면 다음부터 홈 화면 아이콘으로 바로 시작해요.</p>
            <ol className="install-steps">
              <li>
                <b>
                  Safari의 공유 버튼 <span aria-label="공유">⇧</span>
                </b>
                을 누르세요. 보이지 않으면 주소창 옆의 메뉴를 열어 주세요.
              </li>
              <li>
                <b>홈 화면에 추가</b>를 선택하세요. <b>웹 앱으로 열기</b>가 보이면 켜고 <b>추가</b>를
                누르세요.
              </li>
              <li>
                홈 화면의 <b>TURBO RALLY</b> 아이콘을 열고 아이폰을 가로로 돌리세요.
              </li>
            </ol>
            <p className="install-note">
              아이폰에서는 Safari의 공유 메뉴에서 직접 추가해야 해요. 이 창의 버튼으로 자동 설치되지는 않아요.
            </p>
          </>
        ) : (
          <>
            <p>게임을 앱으로 추가하면 주소창 없는 화면에서 실행할 수 있어요.</p>
            {available ? (
              <button className="btn" disabled={installing} onClick={install}>
                {installing ? '설치 확인 중…' : '홈 화면에 추가하기'}
              </button>
            ) : (
              <p>
                브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해 주세요.
              </p>
            )}
          </>
        )}
        <div className="install-help-actions">
          <button className="btn ghost" onClick={() => setOpen(false)}>
            확인 · 게임 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
