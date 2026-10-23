export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const hasTouchControls = () => navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
export function isStandalone() {
  return (
    !!(navigator as Navigator & { standalone?: boolean }).standalone ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches
  );
}
export function gameViewport() {
  const v = window.visualViewport;
  return {
    width: Math.round(v?.width ?? window.innerWidth),
    height: Math.round(v?.height ?? window.innerHeight),
    left: Math.round(v?.offsetLeft ?? 0),
    top: Math.round(v?.offsetTop ?? 0),
  };
}
/** Safari's address bar and keyboard can resize the visual viewport without resizing the layout viewport. */
export function watchGameViewport() {
  let frame = 0;
  const apply = () => {
    const v = gameViewport(),
      root = document.documentElement;
    root.style.setProperty('--app-width', `${v.width}px`);
    root.style.setProperty('--app-height', `${v.height}px`);
    root.style.setProperty('--app-left', `${v.left}px`);
    root.style.setProperty('--app-top', `${v.top}px`);
    root.dataset.viewport = v.height < 300 ? 'tiny' : v.height <= 520 ? 'compact' : 'regular';
    const editing = document.activeElement?.matches('input:not([type="checkbox"]):not([type="range"]), textarea');
    // Keep actions stationary between input blur and the keyboard's closing resize.
    root.dataset.keyboard = (v.height < 210 || v.height < window.innerHeight * .75) && (editing || root.dataset.keyboard === 'open') ? 'open' : 'closed';
    window.dispatchEvent(new Event('gameviewportchange'));
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  };
  apply();
  window.addEventListener('resize', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  };
}
export function showInstallHelp() {
  window.dispatchEvent(new Event('gameinstallhelp'));
}

/** This is called in the originating tap, before audio/network awaits consume user activation. */
export async function requestGameFullscreen(showHelp = true): Promise<boolean> {
  if (isStandalone() || document.fullscreenElement) return true;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else {
      if (showHelp) showInstallHelp();
      return false;
    }
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.(
        'landscape',
      );
    } catch {
      /* rotate manually where locking is unsupported */
    }
    return true;
  } catch {
    if (showHelp) showInstallHelp();
    return false;
  }
}
export function toggleGameFullscreen() {
  if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
  return requestGameFullscreen();
}
export function showMobileMirror() {
  return !hasTouchControls() || gameViewport().height >= 300;
}
