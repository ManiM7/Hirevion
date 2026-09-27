import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/PageLoader';
import AppLayout from './layouts/AppLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

// Everything past the entry pages is split into per-page chunks, downloaded on first visit.
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Notifications = lazy(() => import('./pages/Notifications'));

const CandidateDashboard = lazy(() => import('./pages/candidate/Dashboard'));
const CandidateProfile = lazy(() => import('./pages/candidate/Profile'));
const CandidateResume = lazy(() => import('./pages/candidate/Resume'));
const AssessmentStart = lazy(() => import('./pages/candidate/AssessmentStart'));
const AssessmentTake = lazy(() => import('./pages/candidate/AssessmentTake'));
const AssessmentResult = lazy(() => import('./pages/candidate/AssessmentResult'));
const CandidateProgress = lazy(() => import('./pages/candidate/Progress'));
const CandidateSettings = lazy(() => import('./pages/candidate/Settings'));
const InterviewStart = lazy(() => import('./pages/candidate/InterviewStart'));
const InterviewTake = lazy(() => import('./pages/candidate/InterviewTake'));
const InterviewResult = lazy(() => import('./pages/candidate/InterviewResult'));
const CandidateConnections = lazy(() => import('./pages/candidate/Connections'));
const CandidateConnectionDetail = lazy(() => import('./pages/candidate/ConnectionDetail'));

const RecruiterDashboard = lazy(() => import('./pages/recruiter/Dashboard'));
const RecruiterCandidates = lazy(() => import('./pages/recruiter/Candidates'));
const RecruiterCandidateDetail = lazy(() => import('./pages/recruiter/CandidateDetail'));
const RecruiterCompany = lazy(() => import('./pages/recruiter/Company'));
const RecruiterProfilePage = lazy(() => import('./pages/recruiter/Profile'));
const RecruiterSettings = lazy(() => import('./pages/recruiter/Settings'));
const RecruiterConnections = lazy(() => import('./pages/recruiter/Connections'));
const RecruiterConnectionDetail = lazy(() => import('./pages/recruiter/ConnectionDetail'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminQuestions = lazy(() => import('./pages/admin/Questions'));
const AdminAssessments = lazy(() => import('./pages/admin/Assessments'));
const AdminCompanies = lazy(() => import('./pages/admin/Companies'));

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/home" element={<RoleHome />} />
          </Route>

          {/* Distraction-free test-taking view — no sidebar/topbar */}
          <Route element={<ProtectedRoute roles={['candidate']} />}>
            <Route path="/candidate/assessment/:id" element={<AssessmentTake />} />
            <Route path="/candidate/interview/:id" element={<InterviewTake />} />
          </Route>

          <Route element={<ProtectedRoute roles={['candidate']} />}>
            <Route element={<AppLayout />}>
              <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
              <Route path="/candidate/profile" element={<CandidateProfile />} />
              <Route path="/candidate/resume" element={<CandidateResume />} />
              <Route path="/candidate/assessment" element={<AssessmentStart />} />
              <Route path="/candidate/assessment/:id/result" element={<AssessmentResult />} />
              <Route path="/candidate/progress" element={<CandidateProgress />} />
              <Route path="/candidate/settings" element={<CandidateSettings />} />
              <Route path="/candidate/interview" element={<InterviewStart />} />
              <Route path="/candidate/interview/:id/result" element={<InterviewResult />} />
              <Route path="/candidate/connections" element={<CandidateConnections />} />
              <Route path="/candidate/connections/:id" element={<CandidateConnectionDetail />} />
              <Route path="/candidate/notifications" element={<Notifications />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['recruiter']} />}>
            <Route element={<AppLayout />}>
              <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
              <Route path="/recruiter/candidates" element={<RecruiterCandidates />} />
              <Route path="/recruiter/candidates/:id" element={<RecruiterCandidateDetail />} />
              <Route path="/recruiter/company" element={<RecruiterCompany />} />
              <Route path="/recruiter/profile" element={<RecruiterProfilePage />} />
              <Route path="/recruiter/settings" element={<RecruiterSettings />} />
              <Route path="/recruiter/connections" element={<RecruiterConnections />} />
              <Route path="/recruiter/connections/:id" element={<RecruiterConnectionDetail />} />
              <Route path="/recruiter/notifications" element={<Notifications />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route element={<AppLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/questions" element={<AdminQuestions />} />
              <Route path="/admin/assessments" element={<AdminAssessments />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
