import { useEffect, useState } from 'react';
import { Hud } from '../Hud';
import { TouchControls } from '../Touch';
import { useHud } from '../hudStore';
import { getShell } from '../../game/shell';
import { useApp } from '../../game/app';
import { input } from '../../core/input';
import { music } from '../../audio/music';
import { Modal, sfx } from '../common';
import { startRaceFlow } from '../raceFlow';
import { SettingsBody } from './Settings';
import { toggleGameFullscreen } from '../../core/mobileDisplay';

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export function RaceView() {
  const phase = useHud((s) => s.phase);
  const paused = useHud((s) => s.paused);
  const trackName = useHud((s) => s.trackName);
  const { trackId, mode, difficulty, go } = useApp();
  const [settings, setSettings] = useState(false);
  const setPaused = (v: boolean) => {
    input.reset();
    const r = getShell().race;
    if (r) r.paused = v;
    useHud.getState().set({ paused: v });
    if (v) audio_pause();
    else audio_resume();
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (input.consume('pause') && phase !== 'loading') setPaused(!useHud.getState().paused);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (paused) input.reset();
  }, [paused]);
  return (
    <>
      {phase === 'loading' && (
        <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#D6EAFF,#e2d1ff)', zIndex: 5 }}>
          <div className="title-logo" style={{ fontSize: 64, animation: 'bob 1.6s ease-in-out infinite' }}>
            TURBO RALLY
          </div>
          <p style={{ color: '#fff', fontSize: 22, textShadow: '0 2px 4px #2F6FDB' }}>트랙을 준비하고 있어요… 🏗️</p>
          <p style={{ color: '#fff' }}>💡 드리프트를 길게 유지하면 하늘 → 복숭아 → 라벤더 불꽃! 3단 미니터보가 가장 빨라요</p>
        </div>
      )}
      {phase !== 'loading' && <Hud onPause={() => setPaused(true)} />}
      {phase !== 'loading' && isTouch && !paused && <TouchControls />}
      {paused && !settings && (
        <Modal className="pause-modal" label="일시정지">
          <h2 style={{ marginTop: 0, textAlign: 'center' }}>⏸ 일시정지 — {trackName}</h2>
          <div className="pause-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
            <button
              className="btn big"
              onClick={() => {
                sfx.click();
                setPaused(false);
              }}
            >
              ▶ 계속하기
            </button>
            <button
              className="btn sky"
              onClick={() => {
                sfx.click();
                useHud.getState().set({ paused: false });
                getShell().endRace();
                startRaceFlow(trackId, mode, difficulty);
              }}
            >
              🔄 다시 시작
            </button>
            <button className="btn ghost" onClick={toggleFullscreen}>
              {document.fullscreenElement ? '전체 화면 끄기' : '전체 화면'}
            </button>
            <button className="btn lav" onClick={() => setSettings(true)}>
              ⚙️ 설정
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                sfx.back();
                useHud.getState().set({ paused: false, active: false });
                getShell().endRace();
                music.play('menu');
                go('menu');
              }}
            >
              🏠 메뉴로 나가기
            </button>
          </div>
        </Modal>
      )}
      {paused && settings && (
        <Modal onClose={() => setSettings(false)} wide>
          <SettingsBody />
          <button className="btn" onClick={() => setSettings(false)} style={{ marginTop: 10 }}>
            돌아가기
          </button>
        </Modal>
      )}
    </>
  );
}
function toggleFullscreen() {
  void toggleGameFullscreen();
}
function audio_pause() {
  import('../../audio/engine').then(({ audio }) => audio.ctx?.suspend());
}
function audio_resume() {
  import('../../audio/engine').then(({ audio }) => audio.ctx?.resume());
}
