/** Production App and authentication, without a GPU-dependent showroom. Development only. */
import { createRoot } from 'react-dom/client';
import '../ui/styles.css';
import { App } from '../ui/App';
import { useApp } from '../game/app';
import { useProfile } from '../net/profileStore';
import { watchGameViewport } from '../core/mobileDisplay';
watchGameViewport();
useProfile.setState({ loaded: true, server: true });
useApp.getState().set({ screen: 'loading', modal: 'login' });
(window as unknown as { review: unknown }).review = { app: useApp, profile: useProfile };
createRoot(document.getElementById('root')!).render(<App />);
