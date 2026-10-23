import { createRoot } from 'react-dom/client';
import '../ui/styles.css';
import { Renderer } from '../core/renderer';
import { loadFonts } from '../art/fonts';
import { RaceSession } from '../race/race';
import { Hud } from '../ui/Hud';
import { input } from '../core/input';
import { audio } from '../audio/engine';
import { CHARACTERS, type CharId } from '../data/characters';
import { VEHICLES } from '../data/vehicles';
import { useHud } from '../ui/hudStore';
import { TouchControls } from '../ui/Touch';
import { TRACK_BY_ID } from '../data/tracks';

const q = new URLSearchParams(location.search);
await loadFonts();
input.attach();
const R = new Renderer(document.getElementById('c') as HTMLCanvasElement, (q.get('q') as 'high') ?? 'high');
const charId = (q.get('char') ?? 'momo') as CharId;
const vehicleId = q.get('vehicle') ?? 'coupang';
const others = CHARACTERS.filter((c) => c.id !== charId);
const vs = VEHICLES.filter((v) => v.id !== vehicleId);
const session = new RaceSession(
  {
    trackId: q.get('track') ?? 't1',
    mode: (q.get('mode') as 'race') ?? 'race',
    difficulty: 'normal',
    laps: Number(q.get('laps') ?? TRACK_BY_ID[q.get('track') ?? 't1']?.laps ?? 3),
    player: { charId, vehicleId, loadout: {}, weapons: ['w_slingshot', 'w_bubblegun', 'w_laser'] },
    ai: others.map((c, i) => ({ charId: c.id, vehicleId: vs[(i * 3) % vs.length].id, loadout: {}, weapons: ['w_duck', 'w_snowball'] })),
  },
  R,
);
session.onFinish = (r) => console.log('RESULT', JSON.stringify({ pos: r.position, total: r.totalMs, laps: r.lapTimes }));
(window as unknown as { session: RaceSession }).session = session;
const root = createRoot(document.getElementById('root')!);
root.render(
  <>
    <Hud onPause={() => (session.paused = !session.paused)} />
    {'ontouchstart' in window && <TouchControls />}
  </>,
);
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
session.start();
const dc = q.get('cam');
if (dc) {
  const [x, y, z, lx, ly, lz] = dc.split(',').map(Number);
  const THREE = await import('three');
  session.debugCam = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(lx, ly, lz) };
}
if (q.get('autoplay')) {
  // dev: let an AI drive the player
  import('../ai/driver').then(({ AIDriver }) => {
    session.player.ai = new AIDriver(5, 'balanced', 'hard');
    session.autoplay = true;
  });
}
const ts = Number(q.get('ts') ?? 1);
let last = performance.now();
let frames = 0;
let fpsT = 0;
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  frames++;
  fpsT += dt;
  if (fpsT > 0.5) {
    useHud.getState().set({ fps: Math.round(frames / fpsT) });
    (window as unknown as { __fps: number }).__fps = Math.round(frames / fpsT);
    frames = 0;
    fpsT = 0;
  }
  session.frame(dt * ts);
  R.sample(dt * 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
