import { useLayoutEffect, useRef } from 'react';
import { gameViewport } from '../core/mobileDisplay';
import { setShowroomArea } from '../game/showroomLayout';

/** This empty space is shared with the 3D camera; menu controls must stay outside it. */
export function ShowroomSpace({ label, caption = true }: { label: string; caption?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    const update = () => {
      const r = element.getBoundingClientRect(), v = gameViewport();
      setShowroomArea(r.width > 0 && r.height > 24 ? {
        x: r.left - v.left, y: r.top - v.top, width: r.width, height: r.height - (caption ? 24 : 0),
      } : null);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('gameviewportchange', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('gameviewportchange', update);
      setShowroomArea(null);
    };
  }, [caption]);
  return <div className="showroom-space" ref={ref} role="img" aria-label={label}>
    {caption && <span className="showroom-caption">{label}</span>}
  </div>;
}
