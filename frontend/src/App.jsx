import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import PracticePage from './pages/PracticePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SessionSummaryPage from './pages/SessionSummaryPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import ExamSimulationPage from './pages/ExamSimulationPage';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Navigate to="/?auth=login" replace />} />
      <Route path="/register" element={<Navigate to="/?auth=register" replace />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <Layout>
              <PracticePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Layout>
              <AnalyticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/exam-simulation"
        element={
          <ProtectedRoute>
            <Layout>
              <ExamSimulationPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/session-summary"
        element={
          <ProtectedRoute>
            <Layout>
              <SessionSummaryPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-analytics"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminAnalyticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
