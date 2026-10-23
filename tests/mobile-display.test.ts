import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  gameViewport,
  isStandalone,
  requestGameFullscreen,
  watchGameViewport,
} from '../src/core/mobileDisplay';

beforeEach(() => {
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('screen', { orientation: { lock: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('Safari visible viewport', () => {
  it('uses the area remaining under the address bar and its offset rather than the layout height', () => {
    vi.stubGlobal('window', {
      innerWidth: 844,
      innerHeight: 390,
      visualViewport: { width: 844, height: 250, offsetLeft: 0, offsetTop: 12 },
    });
    expect(gameViewport()).toEqual({ width: 844, height: 250, left: 0, top: 12 });
  });
  it('falls back on browsers without VisualViewport', () => {
    vi.stubGlobal('window', { innerWidth: 667, innerHeight: 320 });
    expect(gameViewport()).toEqual({ width: 667, height: 320, left: 0, top: 0 });
  });
  it('updates CSS on address bar movement and removes listeners when stopped', () => {
    const viewport = Object.assign(new EventTarget(), {
      width: 844,
      height: 250,
      offsetLeft: 0,
      offsetTop: 0,
    });
    const win = Object.assign(new EventTarget(), {
      innerWidth: 844,
      innerHeight: 390,
      visualViewport: viewport,
    });
    const style = { setProperty: vi.fn() },
      root = { style, dataset: {} as Record<string, string> };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => {
      fn();
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const stop = watchGameViewport();
    expect(style.setProperty).toHaveBeenCalledWith('--app-height', '250px');
    expect(root.dataset.viewport).toBe('tiny');
    viewport.height = 390;
    viewport.dispatchEvent(new Event('resize'));
    expect(style.setProperty).toHaveBeenLastCalledWith('--app-top', '0px');
    expect(root.dataset.viewport).toBe('compact');
    stop();
    style.setProperty.mockClear();
    viewport.height = 200;
    viewport.dispatchEvent(new Event('resize'));
    expect(style.setProperty).not.toHaveBeenCalled();
  });
});

describe('honest fullscreen and installation fallback', () => {
  it('recognizes iPhone home screen app mode without requiring the Fullscreen API', async () => {
    vi.stubGlobal('navigator', { standalone: true });
    vi.stubGlobal('document', { documentElement: {} });
    expect(isStandalone()).toBe(true);
    expect(await requestGameFullscreen()).toBe(true);
  });
  it('opens installation guidance when iPhone fullscreen is unavailable', async () => {
    const win = new EventTarget(),
      help = vi.fn();
    win.addEventListener('gameinstallhelp', help);
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { documentElement: {} });
    expect(await requestGameFullscreen()).toBe(false);
    expect(help).toHaveBeenCalledOnce();
  });
  it('does not interrupt race start with an installation modal on unsupported browsers', async () => {
    const win = new EventTarget(),
      help = vi.fn();
    win.addEventListener('gameinstallhelp', help);
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { documentElement: {} });
    expect(await requestGameFullscreen(false)).toBe(false);
    expect(help).not.toHaveBeenCalled();
  });
  it('requests fullscreen in the tap and tolerates unsupported orientation locking', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('document', { documentElement: { requestFullscreen: request } });
    vi.stubGlobal('screen', { orientation: { lock: vi.fn().mockRejectedValue(new Error('unsupported')) } });
    const result = requestGameFullscreen();
    expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(await result).toBe(true);
  });
  it('keeps the game usable if fullscreen is denied', async () => {
    const win = new EventTarget(),
      help = vi.fn();
    win.addEventListener('gameinstallhelp', help);
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      documentElement: { requestFullscreen: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    expect(await requestGameFullscreen()).toBe(false);
    expect(help).toHaveBeenCalledOnce();
  });
});
