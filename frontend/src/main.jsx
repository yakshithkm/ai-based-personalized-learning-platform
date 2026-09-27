import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { GamificationProvider } from './context/GamificationContext';
import './index.css';
import './styles/global.css';
import './styles/components.css';
import './styles/features/exam.css';
import './styles/features/practice.css';
import './styles/features/landing.css';
import './styles/features/profile.css';
import './styles/features/app-shell.css';
import './styles/features/dashboard.css';
import './styles/features/subpages.css';
import './styles/features/analytics.css';
import './styles/features/admin.css';
import './styles/features/ai-tutor.css';
import './styles/features/learning.css';
import './styles/features/gamification.css';
import './styles/features/about-exams.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <GamificationProvider>
              <App />
            </GamificationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
