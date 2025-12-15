import { StrictMode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { InterviewProvider } from './interview/interviewState';
import './index.css';
import App from './App.jsx';

// GLOBAL PWA CAPTURE: Listen immediately to catch the event before React mounts
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});

// Only register service worker in production to minimize dev risks
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InterviewProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </InterviewProvider>
  </StrictMode>
);
