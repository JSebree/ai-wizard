import { StrictMode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { InterviewProvider } from './interview/interviewState';
import './index.css';
import App from './App.jsx';

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
