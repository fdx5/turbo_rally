import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { createShell } from './game/shell';
import { useApp } from './game/app';
import { useProfile } from './net/profileStore';
import { loadFonts } from './art/fonts';
import { prewarmPortraits } from './ui/portraits';
import { watchGameViewport } from './core/mobileDisplay';

async function boot() {
  watchGameViewport();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
  const app = useApp.getState();
  app.set({ loadingMsg: '폰트를 불러오는 중…', loadingPct: 10 });
  await loadFonts();
  app.set({ loadingMsg: '무대를 꾸미는 중…', loadingPct: 35 });
  await new Promise((r) => setTimeout(r, 30));
  createShell(canvas);
  app.set({ loadingMsg: '진행도를 불러오는 중…', loadingPct: 70 });
  await useProfile.getState().load();
  app.set({ loadingMsg: '준비 완료!', loadingPct: 100 });
  prewarmPortraits();
  setTimeout(() => useApp.getState().set({ screen: 'title' }), 250);
}
boot();
