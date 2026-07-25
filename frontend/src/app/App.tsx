import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../pages/landing/LandingPage';
import { GamePage } from '../pages/game/GamePage';

export default function App() { return <Routes><Route path="/" element={<LandingPage />} /><Route path="/game/:sessionId" element={<GamePage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>; }
