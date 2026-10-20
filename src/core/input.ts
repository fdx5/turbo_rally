import { useSettings } from './settings';

/** Unified input state (keyboard + gamepad + touch). Edge-triggered actions are consumed by the game. */
export interface InputState {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  lookBack: boolean;
}
class Input {
  state: InputState = { steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false };
  private keys = new Set<string>();
  private edges = new Set<'item' | 'skill' | 'pause' | 'driftPress' | 'any'>();
  touch = { steer: 0, accel: false, brake: false, drift: false, lookBack: false, active: false };
  tilt = 0;
  private padPrev: boolean[] = [];
  attached = false;

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!e.repeat) {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE' || e.code === 'KeyX') this.edges.add('item');
        if (e.code === 'KeyQ' || e.code === 'KeyZ') this.edges.add('skill');
        if (e.code === 'Escape' || e.code === 'KeyP') this.edges.add('pause');
        if (e.code === 'Space') this.edges.add('driftPress');
        this.edges.add('any');
      }
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      // Landscape: beta is the steering axis; sign depends on orientation angle.
      const ang = (screen.orientation?.angle ?? 0) === 270 ? -1 : 1;
      this.tilt = Math.max(-1, Math.min(1, (e.beta / 25) * ang));
    });
  }
  press(edge: 'item' | 'skill' | 'pause' | 'driftPress') {
    this.edges.add(edge);
  }
  consume(edge: 'item' | 'skill' | 'pause' | 'driftPress' | 'any') {
    const had = this.edges.has(edge);
    this.edges.delete(edge);
    return had;
  }
  clearEdges() {
    this.edges.clear();
  }
  update() {
    const k = this.keys;
    let steer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let throttle = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    let brake = k.has('ArrowDown') || k.has('KeyS') ? 1 : 0;
    let drift = k.has('Space');
    let lookBack = k.has('KeyC');

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.15) steer = ax;
      if (p.buttons[12]?.pressed) throttle = 1;
      const b = (i: number) => !!p.buttons[i]?.pressed;
      if (b(0) || b(7)) throttle = Math.max(throttle, p.buttons[7]?.value || 1);
      if (b(1) || b(6)) brake = 1;
      if (b(5) || b(4)) drift = true;
      if (b(3)) lookBack = true;
      const edgesMap: [number, 'item' | 'skill' | 'pause'][] = [[2, 'item'], [14, 'item'], [15, 'skill'], [9, 'pause']];
      for (const [i, e] of edgesMap) {
        if (b(i) && !this.padPrev[i]) this.edges.add(e);
      }
      if ((b(5) || b(4)) && !(this.padPrev[5] || this.padPrev[4])) this.edges.add('driftPress');
      this.padPrev = p.buttons.map((x) => x.pressed);
      break;
    }

    const t = this.touch;
    if (t.active) {
      const mode = useSettings.getState().touchSteer;
      const ts = mode === 'tilt' ? this.tilt : t.steer;
      if (Math.abs(ts) > 0.05) steer = ts;
      if (t.accel || useSettings.getState().autoAccel) throttle = Math.max(throttle, 1);
      if (t.brake) {
        brake = 1;
        throttle = 0;
      }
      drift = drift || t.drift;
      lookBack = lookBack || t.lookBack;
    }
    this.state.steer = Math.max(-1, Math.min(1, steer));
    this.state.throttle = throttle;
    this.state.brake = brake;
    this.state.drift = drift;
    this.state.lookBack = lookBack;
  }
}
export const input = new Input();
