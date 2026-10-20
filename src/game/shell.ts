import { Renderer } from '../core/renderer';
import { Showroom } from './showroom';
import { RaceSession, type RaceConfig, type RaceResult } from '../race/race';
import { useSettings } from '../core/settings';
import { useHud } from '../ui/hudStore';
import { input } from '../core/input';

/** Owns the renderer and the single requestAnimationFrame loop (menus ↔ race). */
export class GameShell {
  R: Renderer;
  showroom: Showroom;
  race: RaceSession | null = null;
  private last = performance.now();
  private frames = 0;
  private fpsT = 0;
  fps = 60;
  private raf = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.R = new Renderer(canvas, useSettings.getState().quality);
    useSettings.subscribe((s, p) => {
      if (s.quality !== p.quality) this.R.setQuality(s.quality);
    });
    this.showroom = new Showroom(this.R);
    this.showroom.activate();
    input.attach();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.race && this.race.phase === 'race') {
        this.race.paused = true;
        useHud.getState().set({ paused: true });
      }
    });
  }
  startRace(cfg: RaceConfig, onFinish: (r: RaceResult) => void) {
    this.endRace();
    const s = new RaceSession(cfg, this.R);
    s.onFinish = onFinish;
    this.race = s;
    s.start();
    return s;
  }
  endRace() {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
    this.showroom.activate();
  }
  private loop(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsT);
      this.frames = 0;
      this.fpsT = 0;
      if (this.race) useHud.getState().set({ fps: this.fps });
      (window as unknown as { __fps: number }).__fps = this.fps;
    }
    if (this.race) this.race.frame(dt);
    else this.showroom.frame(dt);
    this.R.sample(dt * 1000);
    this.raf = requestAnimationFrame(this.loop);
  }
}
let shell: GameShell | null = null;
export const getShell = () => shell!;
export function createShell(canvas: HTMLCanvasElement) {
  shell = new GameShell(canvas);
  return shell;
}
