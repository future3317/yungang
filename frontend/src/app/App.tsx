import { lazy, Suspense } from 'react';
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

export default function App() {
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
