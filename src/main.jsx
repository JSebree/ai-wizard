import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { InterviewProvider } from './interview/interviewState';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InterviewProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </InterviewProvider>
  </StrictMode>
);
