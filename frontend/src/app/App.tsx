import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
const LandingPage = lazy(() =>
  import('../pages/landing/LandingPage').then((module) => ({ default: module.LandingPage }))
);
const GamePage = lazy(() => import('../pages/game/GamePage').then((module) => ({ default: module.GamePage })));
const GameResultPage = lazy(() =>
  import('../pages/result/GameResultPage').then((module) => ({ default: module.GameResultPage }))
);
const RoomPage = lazy(() => import('../pages/room/RoomPage').then((module) => ({ default: module.RoomPage })));
const HelpPage = lazy(() => import('../pages/help/HelpPage').then((module) => ({ default: module.HelpPage })));
import { MapEditor } from '../pages/dev/MapEditor';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const isDevelopment = import.meta.env.DEV;
const desktopQuery = '(min-width: 1024px)';

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(desktopQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

function DesktopOnlyNotice() {
  return (
    <main className="state-screen desktop-only-screen">
      <div>
        <p className="desktop-only-kicker">石窟光谱 · PC 版</p>
        <h1>请使用桌面端访问</h1>
        <p>当前游戏只维护桌面端体验，请使用宽度至少 1024px 的桌面浏览器继续。</p>
      </div>
    </main>
  );
}

export default function App() {
  const isDesktop = useDesktopViewport();
  if (!isDesktop) return <DesktopOnlyNotice />;

  return (
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <main className="state-screen">
            <span className="loading-orbit" />
            <p>正在打开旅程…</p>
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/room/:roomId/game" element={<GamePage />} />
          <Route path="/room/:roomId/result" element={<GameResultPage />} />
          <Route path="/resume" element={<LandingPage />} />
          <Route path="/help" element={<HelpPage />} />
          {isDevelopment && <Route path="/dev/map-editor" element={<MapEditor />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
