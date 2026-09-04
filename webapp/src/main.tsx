import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import { assertProductionMockDataDisabled } from '@/lib/mock-data-safety';
import { AppProviders } from '@/providers/app-providers';

// Same guard app/_layout.tsx runs on mobile: a production bundle must never
// boot against fixture data.
assertProductionMockDataDisabled();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
