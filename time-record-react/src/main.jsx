import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Order matters: the shadcn/ui base layer first, then the stable stylesheet
// carried over unchanged from the legacy app. Tailwind's preflight is disabled
// so it can never override the existing visual language.
import './index.css';
import './styles.css';

import App from './App.jsx';

let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 350 && !e.target.closest('button, a, input, textarea, label, [role="button"]')) {
    e.preventDefault();
  }
  lastTap = now;
}, { passive: false });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
