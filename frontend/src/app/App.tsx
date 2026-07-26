import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../pages/landing/LandingPage';
import { GamePage } from '../pages/game/GamePage';
import { GameResultPage } from '../pages/result/GameResultPage';

export default function App() { return <Routes><Route path="/" element={<LandingPage />} /><Route path="/game/:sessionId/result" element={<GameResultPage />} /><Route path="/game/:sessionId" element={<GamePage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
