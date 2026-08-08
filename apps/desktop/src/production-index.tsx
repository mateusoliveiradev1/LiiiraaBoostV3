import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DesktopApp } from './app.js';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Desktop root element "#root" was not found.');

createRoot(rootElement).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
