import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AdminLayout from './components/admin/AdminLayout';
import HomePage from './pages/HomePage';

// Route-based code splitting: only HomePage (the public landing page every visitor
// hits first) ships in the initial bundle. Everything else, including the dedicated
// /login and /register screens, loads on demand, so a student who only ever uses
// /exam-simulation isn't downloading the admin analytics dashboard, charts library,
// etc. up front.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SessionSummaryPage = lazy(() => import('./pages/SessionSummaryPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'));
const ExamSimulationPage = lazy(() => import('./pages/ExamSimulationPage'));
const ExamSimulationResultPage = lazy(() => import('./pages/ExamSimulationResultPage'));
const WeakTopicsPage = lazy(() => import('./pages/WeakTopicsPage'));
const StudyPlanPage = lazy(() => import('./pages/StudyPlanPage'));
const MistakeBankPage = lazy(() => import('./pages/MistakeBankPage'));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));

// Admin portal - its own dedicated shell/sidebar (components/admin/AdminLayout),
// loaded on demand so student-facing bundles never pull in admin-only code.
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminStudentsPage = lazy(() => import('./pages/admin/AdminStudentsPage'));
const AdminStudentDetailPage = lazy(() => import('./pages/admin/AdminStudentDetailPage'));
const AdminQuestionsPage = lazy(() => import('./pages/admin/AdminQuestionsPage'));
const AdminSubjectsPage = lazy(() => import('./pages/admin/AdminSubjectsPage'));
const AdminTopicsPage = lazy(() => import('./pages/admin/AdminTopicsPage'));
const AdminExamsPage = lazy(() => import('./pages/admin/AdminExamsPage'));
const AdminExamDetailPage = lazy(() => import('./pages/admin/AdminExamDetailPage'));
const AdminAnalyticsSectionPage = lazy(() => import('./pages/admin/AdminAnalyticsSectionPage'));

const PageFallback = () => <div className="center-screen">Loading...</div>;

const App = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
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
        path="/exam-simulation/result"
        element={
          <ProtectedRoute>
            <Layout>
              <ExamSimulationResultPage />
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
        path="/weak-topics"
        element={
          <ProtectedRoute>
            <Layout>
              <WeakTopicsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/study-plan"
        element={
          <ProtectedRoute>
            <Layout>
              <StudyPlanPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mistake-bank"
        element={
          <ProtectedRoute>
            <Layout>
              <MistakeBankPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/flashcards"
        element={
          <ProtectedRoute>
            <Layout>
              <FlashcardsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            <Layout>
              <AchievementsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-analytics"
        element={
          <ProtectedRoute requireAdmin>
            <Layout>
              <AdminAnalyticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin Portal: separate login + its own AdminLayout shell (dedicated
          sidebar), entirely apart from the student Layout/routes above. */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminStudentsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/:id"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminStudentDetailPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminQuestionsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/subjects"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminSubjectsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/topics"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminTopicsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/exams"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminExamsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/exams/:id"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminExamDetailPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute requireAdmin redirectTo="/admin/login">
            <AdminLayout>
              <AdminAnalyticsSectionPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;