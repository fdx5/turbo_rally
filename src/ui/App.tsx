import { useEffect, useRef } from 'react';
import { useApp } from '../game/app';
import { Loading, Title } from './screens/Title';
import { MainMenu, AttendanceModal, RouletteModal } from './screens/MainMenu';
import { ModeSelect, TrackSelect, CharacterSelect, VehicleSelect } from './screens/Select';
import { RaceView } from './screens/RaceView';
import { Results } from './screens/Results';
import { Shop } from './screens/Shop';
import { Dashboard } from './screens/Dashboard';
import { Settings, Missions, Profile } from './screens/Settings';
import { AuthModal, PromoModal } from './screens/Auth';
import { Modal } from './common';
import { audio } from '../audio/engine';
import { useSettings } from '../core/settings';
import { isMobile } from '../core/renderer';

export function App() {
  const screen = useApp((s) => s.screen);
  const modal = useApp((s) => s.modal);
  const set = useApp((s) => s.set);
  const playStart = useRef(Date.now());
  // UI hover/click sounds for every jelly button & card
  useEffect(() => {
    let lastHover: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element)?.closest?.('.btn,.card,.tab');
      if (el && el !== lastHover) {
        lastHover = el;
        audio.play('uiHover', { vol: 0.6 });
      }
      if (!el) lastHover = null;
    };
    const down = () => audio.unlock();
    window.addEventListener('pointerover', over);
    window.addEventListener('pointerdown', down);
    return () => {
      window.removeEventListener('pointerover', over);
      window.removeEventListener('pointerdown', down);
    };
  }, []);
  // 1-hour rest reminder (§17 child-friendly)
  useEffect(() => {
    const id = setInterval(() => {
      if (!useSettings.getState().restReminder) return;
      if (Date.now() - playStart.current > 60 * 60 * 1000 && useApp.getState().screen !== 'race') {
        playStart.current = Date.now();
        set({ modal: 'rest' });
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      {screen === 'loading' && <Loading />}
      {screen === 'title' && <Title />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'mode' && <ModeSelect />}
      {screen === 'track' && <TrackSelect />}
      {screen === 'character' && <CharacterSelect />}
      {screen === 'vehicle' && <VehicleSelect />}
      {screen === 'race' && <RaceView />}
      {screen === 'results' && <Results />}
      {screen === 'shop' && <Shop />}
      {screen === 'dashboard' && <Dashboard />}
      {screen === 'settings' && <Settings />}
      {screen === 'missions' && <Missions />}
      {screen === 'profile' && <Profile />}
      {(modal === 'login' || modal === 'signup') && <AuthModal kind={modal} />}
      {modal === 'promo' && <PromoModal />}
      {modal === 'gate' && <PromoModal gate />}
      {modal === 'attendance' && <AttendanceModal />}
      {modal === 'roulette' && <RouletteModal />}
      {modal === 'rest' && (
        <Modal onClose={() => set({ modal: null })}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64 }}>🧃</div>
            <h2>잠깐 쉬어가요!</h2>
            <p>한 시간 동안 열심히 달렸어요. 물 한 잔 마시고 기지개 쭉~ 🙆</p>
            <button className="btn" onClick={() => set({ modal: null })}>
              알겠어요!
            </button>
          </div>
        </Modal>
      )}
      <div className={`rotate-overlay ${isMobile ? 'mobile' : ''}`}>
        <div>
          <div className="phone">📱</div>
          <p>휴대폰을 가로로 돌려주세요</p>
        </div>
      </div>
    </>
  );
}
