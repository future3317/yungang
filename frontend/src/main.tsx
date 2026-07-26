import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/phase2.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></React.StrictMode>);
