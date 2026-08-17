import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Order matters: the shadcn/ui base layer first, then the stable stylesheet
// carried over unchanged from the legacy app. Tailwind's preflight is disabled
// so it can never override the existing visual language.
import './index.css';
import './styles.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
