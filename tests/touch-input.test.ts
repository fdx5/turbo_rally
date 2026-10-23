import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TouchInput, smoothTouchSteer, touchSteer, tiltAxis } from '../src/core/touchInput';
import { Input } from '../src/core/input';
import { useSettings } from '../src/core/settings';

beforeEach(() => {
  vi.stubGlobal('navigator', { getGamepads: () => [] });
  useSettings.setState({ autoAccel: true, touchSteer: 'stick', touchSensitivity: 1 });
});
afterEach(() => vi.unstubAllGlobals());

describe('multitouch ownership', () => {
  it('steers while drifting and braking without other fingers stealing the stick', () => {
    const touch = new TouchInput();
    expect(touch.hold(1, 'stick')).toBe(true);
    touch.moveStick(1, 0.8);
    expect(touch.hold(2, 'drift')).toBe(true);
    expect(touch.hold(3, 'brake')).toBe(true);
    expect(touch.hold(4, 'stick')).toBe(false);
    touch.moveStick(4, -1);
    expect(touch.steer).toBe(0.8);
    touch.release(2);
    expect(touch.drift).toBe(false);
    expect(touch.brake).toBe(true);
    expect(touch.steer).toBe(0.8);
  });
  it('only clears a held action after its last owning finger releases', () => {
    const touch = new TouchInput();
    touch.hold(1, 'brake');
    touch.hold(2, 'brake');
    touch.release(1);
    expect(touch.brake).toBe(true);
    touch.release(2);
    expect(touch.brake).toBe(false);
  });
  it('restores the remaining steering button when the opposite finger is cancelled', () => {
    const touch = new TouchInput();
    touch.hold(1, 'left');
    touch.hold(2, 'right');
    expect(touch.steer).toBe(0);
    touch.release(2);
    expect(touch.steer).toBe(-1);
    touch.release(1);
    expect(touch.steer).toBe(0);
  });
  it('starts every new stick at neutral and ignores stale release/move events', () => {
    const touch = new TouchInput();
    touch.hold(1, 'stick');
    touch.moveStick(1, 1);
    touch.release(1);
    touch.hold(2, 'stick');
    touch.release(1);
    touch.moveStick(1, -1);
    expect(touch.steer).toBe(0);
    touch.moveStick(2, -0.5);
    expect(touch.steer).toBe(-0.5);
  });
  it('keeps toggle drift through release but clears it together with all controls on reset', () => {
    const touch = new TouchInput();
    touch.toggleDrift();
    touch.hold(1, 'accel');
    touch.hold(2, 'brake');
    touch.hold(3, 'lookBack');
    touch.release(99);
    expect(touch.drift).toBe(true);
    touch.reset();
    expect([touch.steer, touch.accel, touch.brake, touch.drift, touch.lookBack, touch.active]).toEqual([
      0,
      false,
      false,
      false,
      false,
      false,
    ]);
    touch.hold(4, 'stick');
    expect(touch.steer).toBe(0);
  });
});

describe('mobile steering response', () => {
  it('filters centre jitter, keeps small corrections progressive and preserves full lock', () => {
    expect(touchSteer(0.04)).toBe(0);
    expect(touchSteer(0.3)).toBeGreaterThan(0);
    expect(touchSteer(0.3)).toBeLessThan(0.3);
    expect(touchSteer(1)).toBe(1);
    expect(touchSteer(-1)).toBe(-1);
    expect(touchSteer(0.4, 1.3)).toBeGreaterThan(touchSteer(0.4, 0.8));
  });
  it('has the same turn response at 30, 60 and 120 fps', () => {
    const results = [30, 60, 120].map((fps) => {
      let steer = 0;
      for (let n = 0; n < fps / 10; n++) steer = smoothTouchSteer(steer, 1, 1 / fps);
      return steer;
    });
    expect(results[0]).toBeCloseTo(results[1], 8);
    expect(results[1]).toBeCloseTo(results[2], 8);
    expect(results[0]).toBeGreaterThan(0.85);
  });
  it('quickly centres and reverses without an instantaneous full-lock jump', () => {
    expect(smoothTouchSteer(1, -1, 1 / 60)).toBeGreaterThan(-1);
    let value = 1;
    for (let i = 0; i < 12; i++) value = smoothTouchSteer(value, 0, 1 / 60);
    expect(value).toBeLessThan(0.003);
  });
  it('uses the correct sensor axis for both landscape directions and portrait', () => {
    expect(tiltAxis(20, 8, 90)).toBeCloseTo(20);
    expect(tiltAxis(20, 8, 270)).toBeCloseTo(-20);
    expect(tiltAxis(20, 8, -90)).toBeCloseTo(-20);
    expect(tiltAxis(20, 8, 0)).toBeCloseTo(8);
  });
});

describe('unified mobile input', () => {
  it('does not auto-accelerate during countdown, but accepts a manual rocket-start press', () => {
    const input = new Input();
    input.touch.active = true;
    input.update(1 / 60, false);
    expect(input.state.throttle).toBe(0);
    input.touch.hold(1, 'accel');
    input.update(1 / 60, false);
    expect(input.state.throttle).toBe(1);
    input.touch.release(1);
    input.update(1 / 60, true);
    expect(input.state.throttle).toBe(1);
  });
  it('supports manual acceleration when auto is off, with braking taking priority', () => {
    useSettings.setState({ autoAccel: false });
    const input = new Input();
    input.touch.hold(1, 'accel');
    input.update();
    expect(input.state.throttle).toBe(1);
    input.touch.hold(2, 'brake');
    input.update();
    expect(input.state.throttle).toBe(0);
    expect(input.state.brake).toBe(1);
    input.touch.release(2);
    input.update();
    expect(input.state.throttle).toBe(1);
  });
  it('resets steering, held buttons and queued actions on interruption', () => {
    const input = new Input();
    input.touch.hold(1, 'right');
    input.touch.hold(2, 'drift');
    input.press('item');
    input.update();
    input.reset();
    input.update();
    expect(input.state).toEqual({ steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false });
    expect(input.consume('item')).toBe(false);
  });
  it('handles denied Safari sensor permission and unsupported devices without throwing', async () => {
    vi.stubGlobal('window', {
      DeviceOrientationEvent: { requestPermission: vi.fn().mockResolvedValue('denied') },
    });
    expect(await new Input().enableTilt()).toBe(false);
    vi.stubGlobal('window', {});
    expect(await new Input().enableTilt()).toBe(false);
  });
  it('calibrates the current device angle and recalibrates after Safari orientation changes', () => {
    const win = Object.assign(new EventTarget(), { orientation: 90, innerWidth: 844, innerHeight: 390 });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
    vi.stubGlobal('screen', {});
    const input = new Input();
    input.attach();
    const sensor = (beta: number) =>
      win.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma: 8 }));
    sensor(30);
    expect(input.tilt).toBe(0);
    sensor(41);
    expect(input.tilt).toBeCloseTo(0.5);
    win.orientation = -90;
    win.dispatchEvent(new Event('orientationchange'));
    sensor(-30);
    expect(input.tilt).toBe(0);
    sensor(-41);
    expect(input.tilt).toBeCloseTo(0.5);
  });
});
