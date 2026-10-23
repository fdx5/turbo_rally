/** DOM-only Safari QA: production controls and HUD, independent of GPU availability. */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../ui/styles.css';
import { TouchControls } from '../ui/Touch';
import { Hud } from '../ui/Hud';
import { MobileDisplay, InstallButton, FullscreenButton } from '../ui/MobileDisplay';
import { SettingsBody } from '../ui/screens/Settings';
import { useHud } from '../ui/hudStore';
import { input } from '../core/input';
import { useSettings } from '../core/settings';
import { watchGameViewport } from '../core/mobileDisplay';
watchGameViewport();
input.attach();
useHud
  .getState()
  .set({
    active: true,
    phase: 'race',
    items: ['heart', 'bubble'],
    gauge: 100,
    skillIcon: '⚡',
    coins: 8,
    kmh: 109,
  });
(window as unknown as { review: unknown }).review = { input, hud: useHud, settings: useSettings };
function Review() {
  const [settings, setSettings] = useState(false);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#6C9B86' }} />
      <div
        style={{
          position: 'fixed',
          left: '35%',
          width: '30%',
          height: '100%',
          background: '#637386',
          transform: 'perspective(240px) rotateX(35deg)',
          borderInline: '8px solid #FFFFFF',
        }}
      />
      <Hud
        onPause={() => {
          input.reset();
          useHud.getState().set({ paused: true });
          setSettings(true);
        }}
      />
      {!settings && <TouchControls />}
      {settings && (
        <div className="modal-bg">
          <div className="panel modal">
            <SettingsBody />
            <button
              className="btn"
              onClick={() => {
                setSettings(false);
                useHud.getState().set({ paused: false });
              }}
            >
              계속하기
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          top: 80,
          left: '44%',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 20,
        }}
      >
        <InstallButton />
        <FullscreenButton />
      </div>
      <MobileDisplay />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Review />);
let last = performance.now();
function tick(now: number) {
  input.update((now - last) / 1000, useHud.getState().phase === 'race');
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
