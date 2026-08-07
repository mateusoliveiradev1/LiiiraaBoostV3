import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ProductionDesktopApp } from './production-app.js';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Desktop root element "#root" was not found.');

createRoot(rootElement).render(
  <StrictMode>
    <ProductionDesktopApp />
  </StrictMode>,
);
