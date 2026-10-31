import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import HowItWorksPage from './pages/public/HowItWorksPage';
import SolutionsPage from './pages/public/SolutionsPage';
import PricingPage from './pages/public/PricingPage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import PrivacyPage from './pages/public/PrivacyPage';
import TermsPage from './pages/public/TermsPage';

// Auth Pages
import CandidateLogin from './pages/auth/CandidateLogin';
import CandidateRegister from './pages/auth/CandidateRegister';
import HrLogin from './pages/auth/HrLogin';
import HrRegister from './pages/auth/HrRegister';

// Layouts
import CandidateLayout from './components/CandidateLayout';
import HrLayout from './components/HrLayout';

// Candidate Portal Pages
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateResume from './pages/candidate/CandidateResume';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateApplications from './pages/candidate/CandidateApplications';
import CandidateInterviews from './pages/candidate/CandidateInterviews';
import CandidateInterviewRoom from './pages/candidate/CandidateInterviewRoom';
import CandidateReport from './pages/candidate/CandidateReport';
import CandidateActivity from './pages/candidate/CandidateActivity';
import CandidateNotifications from './pages/candidate/CandidateNotifications';
import CandidateSettings from './pages/candidate/CandidateSettings';

// HR Portal Pages
import HrDashboard from './pages/hr/HrDashboard';
import HrJobs from './pages/hr/HrJobs';
import HrJobCreate from './pages/hr/HrJobCreate';
import HrApplicants from './pages/hr/HrApplicants';
import HrTopCandidates from './pages/hr/HrTopCandidates';
import HrCandidateReport from './pages/hr/HrCandidateReport';
import HrCandidateScorecard from './pages/hr/HrCandidateScorecard';
import HrDecisions from './pages/hr/HrDecisions';
import HrAnalytics from './pages/hr/HrAnalytics';
import HrOrganization from './pages/hr/HrOrganization';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
          {/* Public Marketing Website */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Authentication Routes */}
          <Route path="/candidate/login" element={<CandidateLogin />} />
          <Route path="/candidate/register" element={<CandidateRegister />} />
          <Route path="/hr/login" element={<HrLogin />} />
          <Route path="/hr/register" element={<HrRegister />} />

          {/* Candidate Portal */}
          <Route path="/candidate" element={<CandidateLayout />}>
            <Route index element={<Navigate to="/candidate/dashboard" replace />} />
            <Route path="dashboard" element={<CandidateDashboard />} />
            <Route path="profile" element={<CandidateProfile />} />
            <Route path="resume" element={<CandidateResume />} />
            <Route path="jobs" element={<CandidateJobs />} />
            <Route path="applications" element={<CandidateApplications />} />
            <Route path="interviews" element={<CandidateInterviews />} />
            <Route path="interviews/:sessionId" element={<CandidateInterviewRoom />} />
            <Route path="results/:reportId" element={<CandidateReport />} />
            <Route path="activity" element={<CandidateActivity />} />
            <Route path="notifications" element={<CandidateNotifications />} />
            <Route path="settings" element={<CandidateSettings />} />
          </Route>

          {/* HR Recruiter Portal */}
          <Route path="/hr" element={<HrLayout />}>
            <Route index element={<Navigate to="/hr/dashboard" replace />} />
            <Route path="dashboard" element={<HrDashboard />} />
            <Route path="jobs" element={<HrJobs />} />
            <Route path="jobs/create" element={<HrJobCreate />} />
            <Route path="jobs/:jobId/applicants" element={<HrApplicants />} />
            <Route path="jobs/:jobId/top-candidates" element={<HrTopCandidates />} />
            <Route path="applications/:applicationId/scorecard" element={<HrCandidateScorecard />} />
            <Route path="candidates/:candidateId/scorecard" element={<HrCandidateScorecard />} />
            <Route path="reports/:reportId" element={<HrCandidateReport />} />
            <Route path="decisions" element={<HrDecisions />} />
            <Route path="analytics" element={<HrAnalytics />} />
            <Route path="organization" element={<HrOrganization />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}
