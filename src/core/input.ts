import { useSettings } from './settings';
import { TouchInput, touchSteer, smoothTouchSteer, tiltAxis } from './touchInput';

/** Unified input state (keyboard + gamepad + touch). Edge-triggered actions are consumed by the game. */
export interface InputState {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  lookBack: boolean;
}
export class Input {
  state: InputState = { steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false };
  private keys = new Set<string>();
  private edges = new Set<'item' | 'skill' | 'pause' | 'driftPress' | 'any'>();
  touch = new TouchInput();
  tilt = 0;
  private tiltCentre: number | null = null;
  private touchSteering = 0;
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
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('pagehide', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    window.addEventListener('orientationchange', () => { this.reset(); this.calibrateTilt(); });
    screen.orientation?.addEventListener('change', () => { this.reset(); this.calibrateTilt(); });
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      const legacy = (window as Window & { orientation?: number }).orientation;
      const angle = screen.orientation?.angle ?? legacy ?? (window.innerWidth > window.innerHeight ? 90 : 0);
      const value = tiltAxis(e.beta, e.gamma, angle);
      this.tiltCentre ??= value;
      this.tilt = Math.max(-1, Math.min(1, (value - this.tiltCentre) / 22));
    });
  }
  calibrateTilt() {
    this.tiltCentre = null;
    this.tilt = 0;
  }
  /** Call directly from a tap, before any await, for Safari's sensor permission. */
  async enableTilt(): Promise<boolean> {
    const sensor = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }) | undefined;
    if (!sensor) return false;
    try {
      if (sensor.requestPermission && await sensor.requestPermission() !== 'granted') return false;
      this.calibrateTilt();
      return true;
    } catch { return false; }
  }
  reset() {
    this.keys.clear();
    this.edges.clear();
    this.padPrev = [];
    this.touch.reset();
    this.touchSteering = 0;
    this.state = { steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false };
  }
  press(edge: 'item' | 'skill' | 'pause' | 'driftPress' | 'any') {
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
  update(dt = 1 / 60, allowAutoAccel = true) {
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
      const settings = useSettings.getState();
      // The stick remains usable as a fallback when sensor data is unavailable.
      const ts = settings.touchSteer === 'tilt' && t.steer === 0 ? this.tilt : t.steer;
      this.touchSteering = smoothTouchSteer(this.touchSteering, touchSteer(ts, settings.touchSensitivity), dt);
      if (steer === 0) steer = this.touchSteering;
      if (t.accel || (settings.autoAccel && allowAutoAccel)) throttle = Math.max(throttle, 1);
      if (t.brake) {
        brake = 1;
        throttle = 0;
      }
      drift = drift || t.drift;
      lookBack = lookBack || t.lookBack;
    } else this.touchSteering = 0;
    this.state.steer = Math.max(-1, Math.min(1, steer));
    this.state.throttle = throttle;
    this.state.brake = brake;
    this.state.drift = drift;
    this.state.lookBack = lookBack;
  }
}
export const input = new Input();
