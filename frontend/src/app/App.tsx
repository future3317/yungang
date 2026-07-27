import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../pages/landing/LandingPage';
import { GamePage } from '../pages/game/GamePage';
import { GameResultPage } from '../pages/result/GameResultPage';
import { RoomPage } from '../pages/room/RoomPage';
import { HelpPage } from '../pages/help/HelpPage';

export default function App() { return <Routes><Route path="/" element={<LandingPage />} /><Route path="/room/:roomId" element={<RoomPage />} /><Route path="/room/:roomId/game" element={<GamePage />} /><Route path="/result/:sessionId" element={<GameResultPage />} /><Route path="/game/:sessionId/result" element={<GameResultPage />} /><Route path="/game/:sessionId" element={<GamePage />} /><Route path="/resume" element={<LandingPage />} /><Route path="/help" element={<HelpPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
