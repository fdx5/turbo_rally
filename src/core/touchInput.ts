/** Pointer ownership is independent of the DOM: cancelling one finger never releases another. */
export type TouchAction = 'left' | 'right' | 'accel' | 'brake' | 'drift' | 'lookBack' | 'stick';
export class TouchInput {
  steer = 0;
  accel = false;
  brake = false;
  drift = false;
  lookBack = false;
  active = false;
  private pointers = new Map<number, TouchAction>();
  private stickValue = 0;
  private driftLatched = false;

  hold(pointer: number, action: TouchAction): boolean {
    if (this.pointers.has(pointer) || (action === 'stick' && [...this.pointers.values()].includes('stick')))
      return false;
    this.active = true;
    this.pointers.set(pointer, action);
    this.sync();
    return true;
  }
  moveStick(pointer: number, value: number) {
    if (this.pointers.get(pointer) !== 'stick') return;
    this.stickValue = Math.max(-1, Math.min(1, value));
    this.sync();
  }
  release(pointer: number) {
    if (this.pointers.get(pointer) === 'stick') this.stickValue = 0;
    this.pointers.delete(pointer);
    this.sync();
  }
  toggleDrift() {
    this.driftLatched = !this.driftLatched;
    this.sync();
  }
  reset() {
    this.pointers.clear();
    this.stickValue = 0;
    this.driftLatched = false;
    this.active = false;
    this.sync();
  }
  private sync() {
    const held = new Set(this.pointers.values());
    this.steer = held.has('stick') ? this.stickValue : Number(held.has('right')) - Number(held.has('left'));
    this.accel = held.has('accel');
    this.brake = held.has('brake');
    this.drift = held.has('drift') || this.driftLatched;
    this.lookBack = held.has('lookBack');
  }
}

/** A small dead zone and a progressive centre leave full lock reachable. */
export function touchSteer(value: number, sensitivity = 1) {
  const magnitude = Math.min(1, Math.max(0, (Math.abs(value) - 0.06) / 0.94));
  return Math.sign(value) * Math.min(1, Math.pow(magnitude, 1.35) * sensitivity);
}
export function smoothTouchSteer(current: number, target: number, dt: number) {
  // Release/turn reversal are quicker than initial turn-in; independent of refresh rate.
  const rate = target === 0 || current * target < 0 ? 32 : 22;
  const next = current + (target - current) * (1 - Math.exp(-rate * Math.max(0, Math.min(0.1, dt))));
  return Math.abs(next) < 0.001 ? 0 : next;
}

export function tiltAxis(beta: number, gamma: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return beta * Math.sin(radians) + gamma * Math.cos(radians);
}
