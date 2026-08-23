import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { AccessibilitySettings } from './widgets/game/AccessibilitySettings';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/typography.css';
import './styles/primitives.css';
import './styles/landing.css';
import './styles/game-shell.css';
import './styles/map.css';
import './styles/responsive.css';
import './styles/motion.css';
import './styles/components.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <AccessibilitySettings />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
